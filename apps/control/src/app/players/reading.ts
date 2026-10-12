// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Reaches one running server for its players: their facts from the console while they are on,
 * their files otherwise (through the runtime's exec, as access files are read, on every runtime),
 * and the console commands that move them or change their game mode. What the commands and files
 * say is `minecraft/players.ts`'s; what is kept and who may ask is the service's.
 */
import {
  accepted,
  type GameMode,
  livePlayerQueries,
  type Place,
  type PlayerFacts,
  type PlayerStats,
  parseLivePlayer,
  parsePlayerFiles,
  playerFromFile,
  readPlayerFiles,
  setGameMode,
  statsFromFile,
  teleportNearDeath,
  teleportToSpawn,
  worldSpawn,
} from '../../minecraft/players.ts'
import { PORT_NAMES } from '../../minecraft/runtime-spec.ts'
import type { FileFormats } from '../ports/formats.ts'
import type { ServerConsole } from '../ports/minecraft.ts'
import type { RuntimeHandle } from '../ports/runtime.ts'
import type { Runtimes } from '../runtimes/router.ts'
import type { RuntimeSpecs } from '../servers/specs.ts'

export type PlayerAction = { kind: 'place'; what: 'death' | 'spawn' } | { kind: 'game_mode'; what: GameMode }

/**
 * `done`; `at_spawn` where they were to go back where they died but nowhere near it was safe to
 * stand (the void, a lake of lava), so they went to the spawn; `not_on` where the player isn't
 * there to do it to; `nowhere` where there is no such place (they never died here); `failed` where
 * the server didn't answer, or wouldn't.
 */
export type ActionOutcome = 'done' | 'at_spawn' | 'not_on' | 'nowhere' | 'failed'

export interface FromFiles {
  spawn: Place | null
  players: Map<string, { facts: PlayerFacts | null; stats: PlayerStats | null }>
}

export class PlayerReading {
  readonly #runtime: Pick<Runtimes, 'exec' | 'endpoint'>
  readonly #console: ServerConsole
  readonly #specs: Pick<RuntimeSpecs, 'rconPasswords'>
  readonly #formats: Pick<FileFormats, 'decodeNbt' | 'decode'>

  constructor(deps: {
    runtime: Pick<Runtimes, 'exec' | 'endpoint'>
    console: ServerConsole
    specs: Pick<RuntimeSpecs, 'rconPasswords'>
    formats: Pick<FileFormats, 'decodeNbt' | 'decode'>
  }) {
    this.#runtime = deps.runtime
    this.#console = deps.console
    this.#specs = deps.specs
    this.#formats = deps.formats
  }

  /** What the game says of a player who is on, over one console connection; null when they aren't. */
  async live(serverId: string, handle: RuntimeHandle, name: string): Promise<PlayerFacts | null> {
    const answers = await this.#console.runAll(this.#target(serverId, handle), livePlayerQueries(name))
    return parseLivePlayer(answers.map((a) => (a.ok ? a.output : null)))
  }

  /** The world's spawn and these players' files, or the most recent players' (`recent`). */
  async files(handle: RuntimeHandle, players: readonly string[] | 'recent'): Promise<FromFiles> {
    const read = await this.#runtime.exec(handle, readPlayerFiles(players), 60)
    if (read.exitCode !== 0) throw new Error(`Reading players' files failed: ${read.stderr.trim()}`)
    const files = parsePlayerFiles(read.stdout)
    const decoded: FromFiles = {
      spawn:
        files.level === null
          ? null
          : worldSpawn(await this.#formats.decodeNbt(files.level).catch(() => null)),
      players: new Map(),
    }
    for (const [uuid, file] of files.players) {
      // One unreadable file is that player's alone.
      const facts = await this.#formats
        .decodeNbt(file.data)
        .then(playerFromFile)
        .catch(() => null)
      let stats: PlayerStats | null = null
      try {
        stats = file.stats === null ? null : statsFromFile(this.#formats.decode('json', file.stats))
      } catch {
        stats = null
      }
      decoded.players.set(uuid, { facts, stats })
    }
    return decoded
  }

  /** Does it now, to a player who is on: their last death and the spawn are read at that moment. */
  async perform(
    serverId: string,
    handle: RuntimeHandle,
    name: string,
    action: PlayerAction,
  ): Promise<ActionOutcome> {
    if (action.kind === 'game_mode')
      return took(await this.#first(serverId, handle, setGameMode(name, action.what)))
    if (action.what === 'spawn') return this.#toSpawn(serverId, handle, name)
    const facts = await this.live(serverId, handle, name).catch(() => undefined)
    if (facts === undefined) return 'failed'
    if (facts === null) return 'not_on'
    if (facts.lastDeath === null) return 'nowhere'
    const near = await this.#first(serverId, handle, teleportNearDeath(name, facts.lastDeath))
    if (near !== 'refused') return near
    // Nowhere near was safe to stand: the spawn, and whoever asked is told.
    const spawn = await this.#toSpawn(serverId, handle, name)
    if (spawn === 'done') return 'at_spawn'
    return spawn === 'nowhere' ? 'failed' : spawn
  }

  async #toSpawn(serverId: string, handle: RuntimeHandle, name: string): Promise<ActionOutcome> {
    const spawn = await this.files(handle, [])
      .then((files) => files.spawn)
      .catch(() => undefined)
    if (spawn === undefined) return 'failed'
    if (spawn === null) return 'nowhere'
    return took(await this.#first(serverId, handle, teleportToSpawn(name, spawn)))
  }

  /** Each is another way to the same end: the first the server takes is enough. */
  async #first(
    serverId: string,
    handle: RuntimeHandle,
    commands: readonly string[],
  ): Promise<'done' | 'not_on' | 'failed' | 'refused'> {
    for (const command of commands) {
      const answer = await this.#console.run(this.#target(serverId, handle), command).catch(() => null)
      if (answer === null) return 'failed'
      if (accepted(answer)) return 'done'
      if (/^No (player|entity) was found/.test(answer.trim())) return 'not_on'
    }
    return 'refused'
  }

  #target(serverId: string, handle: RuntimeHandle) {
    return {
      endpoint: this.#runtime.endpoint(handle, PORT_NAMES.rcon, 'control'),
      passwords: this.#specs.rconPasswords(serverId),
    }
  }
}

/** Where there is nothing else to try, a refusal is a failure. */
function took(outcome: 'done' | 'not_on' | 'failed' | 'refused'): ActionOutcome {
  return outcome === 'refused' ? 'failed' : outcome
}
