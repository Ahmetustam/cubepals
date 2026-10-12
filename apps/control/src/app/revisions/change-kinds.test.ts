// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { type Harness, hasDatabase, startHarness } from '../../testing/harness.ts'
import { loadRevision } from '../servers/persistence.ts'

// What a change applying to a running server is, as its page reads it to say how long it takes.
describe.skipIf(!hasDatabase)('the kind of a change', () => {
  let h: Harness

  beforeAll(async () => {
    h = await startHarness()
  }, 30_000)

  afterAll(async () => {
    await h.close()
  })

  test('while a change applies, the server’s page says what it is', async () => {
    const owner = await h.user()
    const { id } = await h.create(owner, { name: 'Kinds', gameVersion: '26.2' })
    await h.until(id, 'running')
    await h.settled(id)
    const applying = async () => {
      await h.until(id, 'updating')
      return (await h.app.queries.get(owner, id)).activeOperation
    }
    // Each is held at the provider's stop, mid-apply.
    let release = h.runtime.holdStops(1)
    const settings = (await loadRevision(h.db, (await h.server(id)).desiredRevisionId)).settings
    await h.app.revisions.changeSettings(owner, id, { ...settings, spawnProtection: 8 }, randomUUID())
    expect(await applying()).toMatchObject({ kind: 'apply', change: 'settings' })
    release()
    await h.until(id, 'running')
    await h.settled(id)
    release = h.runtime.holdStops(1)
    await h.app.mods.changeVersion(owner, id, { gameVersion: '26.3', loader: 'vanilla' }, [], randomUUID())
    expect(await applying()).toMatchObject({ kind: 'apply', change: 'version' })
    release()
    await h.until(id, 'running')
    await h.settled(id)
    // Anything else says nothing of a change.
    await h.app.servers.restart(owner, id, randomUUID())
    expect((await h.app.queries.get(owner, id)).activeOperation?.change).toBeNull()
    await h.settled(id)
  })
})
