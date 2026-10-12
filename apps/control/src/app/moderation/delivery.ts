// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Takes the warnings, mutes and bans given from Cubepals to a running server, and the ones taken
 * back. It runs with every full access sync (`AccessReconciler`), so what was given while the
 * server slept reaches it as it starts, before the edge sends anyone in.
 *
 * LibertyBans' reply never comes back over RCON (minecraft/moderation.ts), so a punishment counts as
 * given once the console took the command. A mute or ban keeps the end it was given with: one that
 * waited out its time while the server slept is over and isn't sent at all.
 */
import { MINUTE_MS } from '@blockly/contracts/durations'
import { type Db, schema } from '@blockly/db'
import { and, asc, eq, inArray } from 'drizzle-orm'
import type { MinecraftServer } from '../../domain/server/server.ts'
import { giveCommands, liftCommand } from '../../minecraft/moderation.ts'
import { PORT_NAMES } from '../../minecraft/runtime-spec.ts'
import type { ServerConsole } from '../ports/minecraft.ts'
import type { RuntimeHandle } from '../ports/runtime.ts'
import type { Runtimes } from '../runtimes/router.ts'
import type { RuntimeSpecs } from '../servers/specs.ts'

const actions = schema.serverModerationActions
type Action = typeof actions.$inferSelect

/** When a timed mute or ban given at `at` ends; null for good, and for a warning. */
export const endOf = (action: Pick<Action, 'minutes' | 'createdAt'>): Date | null =>
  action.minutes === null ? null : new Date(action.createdAt.getTime() + action.minutes * MINUTE_MS)

/** An owner's word for a command the server didn't take; it is sent again at the next sync. */
const NOT_TAKEN = 'The server didn’t take it just then, and Cubepals will try again.'

export class ModerationDelivery {
  readonly #db: Db
  readonly #runtime: Runtimes
  readonly #console: ServerConsole
  readonly #specs: RuntimeSpecs

  constructor(deps: { db: Db; runtime: Runtimes; console: ServerConsole; specs: RuntimeSpecs }) {
    this.#db = deps.db
    this.#runtime = deps.runtime
    this.#console = deps.console
    this.#specs = deps.specs
  }

  /** Whether anything was waiting: what changed shows on the owner's page. */
  async deliver(server: MinecraftServer, handle: RuntimeHandle, now = new Date()): Promise<boolean> {
    const waiting = await this.#db
      .select()
      .from(actions)
      .where(and(eq(actions.serverId, server.id), inArray(actions.state, ['pending', 'lifting'])))
      .orderBy(asc(actions.createdAt))
    if (waiting.length === 0) return false

    const over = waiting.filter((a) => a.state === 'pending' && isOver(a, now))
    const sending = waiting.filter((a) => !over.includes(a))
    const results =
      sending.length === 0
        ? []
        : await this.#console.runAll(
            {
              endpoint: this.#runtime.endpoint(handle, PORT_NAMES.rcon, 'control'),
              passwords: this.#specs.rconPasswords(server.id),
            },
            sending.flatMap((a) => commandsFor(a, now)),
          )
    // Each action's own commands, in order: it is given when every one of them was taken.
    let next = 0
    const taken = sending.map((a) => {
      const start = next
      next += commandsFor(a, now).length
      return results.slice(start, next).every((result) => result.ok)
    })

    await this.#db.transaction(async (tx) => {
      for (const action of over)
        await tx
          .update(actions)
          .set({ state: 'delivered', deliveredAt: now, error: null })
          .where(eq(actions.id, action.id))
      for (const [i, action] of sending.entries()) {
        await tx
          .update(actions)
          .set(
            !taken[i]
              ? { error: NOT_TAKEN }
              : action.state === 'lifting'
                ? { state: 'lifted', liftedAt: now, error: null }
                : { state: 'delivered', deliveredAt: now, error: null },
          )
          .where(eq(actions.id, action.id))
      }
    })
    return true
  }
}

const isOver = (action: Action, now: Date) => {
  const end = endOf(action)
  return end !== null && end.getTime() <= now.getTime()
}

/** What the server is told: the punishment for the time it has left, or taking it back. */
function commandsFor(action: Action, now: Date): string[] {
  if (action.state === 'lifting' && action.kind !== 'warn')
    return [liftCommand(action.kind, action.playerUuid)]
  const end = endOf(action)
  return giveCommands({
    kind: action.kind,
    playerUuid: action.playerUuid,
    minutes: end === null ? null : (end.getTime() - now.getTime()) / MINUTE_MS,
    reason: action.reason,
  })
}
