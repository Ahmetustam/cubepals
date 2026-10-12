// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DAY_MS, HOUR_MS, MINUTE_MS } from '@blockly/contracts/durations'
import { type Harness, hasDatabase, startHarness } from '../../testing/harness.ts'

/**
 * Servers made for a while (§15.6): they say when they go, they go on their own, and keeping
 * one is a single decision its owner can make at any time up to then.
 */
describe.skipIf(!hasDatabase)('temporary servers', () => {
  let h: Harness

  beforeAll(async () => {
    h = await startHarness()
  }, 30_000)

  afterAll(async () => {
    await h.close()
  })

  test('a server made for a day carries its own end, and goes when it comes', async () => {
    const owner = await h.user()
    const created = await h.create(owner, { temporary: true })
    const day = DAY_MS
    expect(created.expiresAt).not.toBeNull()
    // A day away, give or take the time the test took.
    const away = (created.expiresAt as Date).getTime() - Date.now()
    expect(away).toBeGreaterThan(day - MINUTE_MS)
    expect(away).toBeLessThanOrEqual(day)

    // Nothing happens before its time.
    expect(await h.app.schedules.expirySweep(new Date(Date.now() + day - MINUTE_MS))).toBe(0)
    expect((await h.server(created.id)).lifecycle.status).not.toBe('deleted')

    // And then it is deleted, the way its owner deleting it would be: into the trash.
    expect(await h.app.schedules.expirySweep(new Date(Date.now() + day + 1_000))).toBe(1)
    const gone = await h.server(created.id)
    expect(gone.lifecycle.status).toBe('deleted')
    expect(gone.purgeAfter).not.toBeNull()
  }, 40_000)

  test('keeping one clears its end, and a sweep afterwards leaves it alone', async () => {
    const owner = await h.user('Alex')
    const created = await h.create(owner, { temporary: true })
    const kept = await h.app.servers.keep(owner, created.id)
    expect(kept.expiresAt).toBeNull()
    expect(await h.app.schedules.expirySweep(new Date(Date.now() + 48 * HOUR_MS))).toBe(0)
    expect((await h.server(created.id)).lifecycle.status).not.toBe('deleted')
  }, 40_000)

  test('an ordinary server has no end at all', async () => {
    const owner = await h.user('Robin')
    const created = await h.create(owner)
    expect(created.expiresAt).toBeNull()
    expect(await h.app.schedules.expirySweep(new Date(Date.now() + 365 * DAY_MS))).toBe(0)
  }, 40_000)
})
