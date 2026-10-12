// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The switch admins flip on the platform page: FLY_SUSPEND until one does, then what they stored,
 * read at each sleep through a short cache, and every change in the audit log.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { type Db, schema } from '@blockly/db'
import { eq } from 'drizzle-orm'
import { freshDatabase, hasDatabase } from '../../testing/fleet.ts'
import { SuspendSwitch } from './suspend-switch.ts'

describe.skipIf(!hasDatabase)('the Fly suspend switch', () => {
  let db: Db
  let drop: () => Promise<void>
  const admin = { kind: 'admin' as const, userId: 'admin-1' }
  const user = { kind: 'user' as const, userId: 'user-1' }

  beforeAll(async () => {
    ;({ db, drop } = await freshDatabase())
  }, 30_000)

  afterAll(async () => {
    await drop()
  })

  beforeEach(async () => {
    await db.update(schema.platformControls).set({ flySuspend: null })
    await db.delete(schema.auditLog)
  })

  const changes = () =>
    db
      .select({ actor: schema.auditLog.actor, data: schema.auditLog.data })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, 'platform.fly_suspend_changed'))
      .orderBy(schema.auditLog.at)

  test('follows FLY_SUSPEND while nothing is stored', async () => {
    for (const fallback of [true, false]) {
      const flySuspend = new SuspendSwitch({ db, fallback })
      expect(await flySuspend.on()).toBe(fallback)
      expect(await flySuspend.view(admin)).toEqual({ on: fallback, source: 'default', default: fallback })
    }
  })

  test('an admin’s choice overrides FLY_SUSPEND, and null returns to it, each audited', async () => {
    const flySuspend = new SuspendSwitch({ db, fallback: true })
    await flySuspend.set(admin, false)
    expect(await flySuspend.on()).toBe(false)
    expect(await flySuspend.view(admin)).toEqual({ on: false, source: 'stored', default: true })

    // Storing what is already stored changes and records nothing.
    await flySuspend.set(admin, false)
    await flySuspend.set(admin, null)
    expect(await flySuspend.on()).toBe(true)
    expect(await flySuspend.view(admin)).toEqual({ on: true, source: 'default', default: true })

    expect(await changes()).toEqual([
      { actor: 'admin:admin-1', data: { from: null, to: false, default: true } },
      { actor: 'admin:admin-1', data: { from: false, to: null, default: true } },
    ])
    const [row] = await db.select().from(schema.platformControls)
    expect(row?.updatedBy).toBe('admin:admin-1')
  })

  test('another process sees a change once its cache runs out', async () => {
    let now = 0
    const elsewhere = new SuspendSwitch({ db, fallback: true, ttlMs: 10_000, now: () => now })
    expect(await elsewhere.on()).toBe(true)
    await new SuspendSwitch({ db, fallback: true }).set(admin, false)
    now = 9_999
    expect(await elsewhere.on()).toBe(true)
    now = 10_000
    expect(await elsewhere.on()).toBe(false)
  })

  test('is for admins only, and has nothing to switch where no server runs on Fly', async () => {
    const flySuspend = new SuspendSwitch({ db, fallback: true })
    await expect(flySuspend.view(user)).rejects.toMatchObject({ name: 'NotFound' })
    await expect(flySuspend.set(user, false)).rejects.toMatchObject({ name: 'NotFound' })

    const noFly = new SuspendSwitch({ db, fallback: null })
    expect(await noFly.view(admin)).toBeNull()
    await expect(noFly.set(admin, true)).rejects.toMatchObject({ code: 'invalid_choice' })
    expect(await noFly.on()).toBe(false)
    expect(await changes()).toEqual([])
  })
})
