// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * How long a wake is told to take: as long as this server's last one did, so its page counts down
 * from what this server does rather than from what servers do on average.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { schema } from '@blockly/db'
import { and, eq } from 'drizzle-orm'
import { type Harness, hasDatabase, startHarness } from '../../testing/harness.ts'
import { lastWakeSeconds } from '../operations/persistence.ts'

const operations = schema.serverOperations

describe.skipIf(!hasDatabase)('how long a wake should take', () => {
  let h: Harness

  beforeAll(async () => {
    h = await startHarness()
  }, 30_000)

  afterAll(async () => {
    await h.close()
  })

  test('is how long its last wake took, and nothing before it ever woke or while it isn’t waking', async () => {
    const owner = await h.user()
    const { id } = await h.create(owner)
    await h.until(id, 'running')
    await h.settled(id)
    // Being built is no wake.
    expect(await lastWakeSeconds(h.db, id, 'booted')).toBeNull()

    for (const took of [68, 31]) {
      await h.app.servers.stop(owner, id, randomUUID())
      await h.until(id, 'stopped')
      await h.settled(id)
      await h.app.servers.start(owner, id, randomUUID())
      await h.until(id, 'running')
      await h.settled(id)
      const [wake] = await h.db
        .select()
        .from(operations)
        .where(and(eq(operations.serverId, id), eq(operations.kind, 'start')))
        .orderBy(operations.createdAt)
        .then((rows) => rows.slice(-1))
      await h.db
        .update(operations)
        .set({ finishedAt: new Date((wake?.createdAt.getTime() ?? 0) + took * 1000) })
        .where(eq(operations.id, wake?.id ?? ''))
    }
    expect(await lastWakeSeconds(h.db, id, 'booted')).toBe(31)
    expect((await h.app.queries.get(owner, id)).lastWakeSeconds).toBeNull()
  }, 60_000)
})
