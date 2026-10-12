// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Where admin mail goes (ADMIN_ALERT_EMAILS): to the configured inbox when it names one, apart
 * from who is an admin, and to each admin's own email when it doesn't.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { schema } from '@blockly/db'
import { sql } from 'drizzle-orm'
import { type Harness, hasDatabase, startHarness } from '../../testing/harness.ts'
import { Outbox } from '../../testing/outbox.ts'
import { PlatformAlerts } from './alerts.ts'

describe.skipIf(!hasDatabase)('the admin inbox', () => {
  let h: Harness
  let adminEmail: string

  // One admin, and the mod catalog failing to answer for seven hours: an alert.
  beforeAll(async () => {
    h = await startHarness()
    const person = await h.user('Admin')
    await h.db.insert(schema.platformAdmins).values({ userId: person.userId, grantedBy: 'test' })
    adminEmail = `${person.userId}@example.test`
    await h.db
      .insert(schema.catalogRefreshes)
      .values({ catalog: 'modrinth', refreshedAt: sql`now() - interval '7 hours'`, failedAt: sql`now()` })
  }, 30_000)

  afterAll(async () => {
    await h.close()
  })

  /** The alerts as the control plane builds them, writing to an outbox of their own. */
  const alerts = (adminInbox?: readonly string[]) => {
    const mail = new Outbox()
    const sweep = new PlatformAlerts({
      db: h.db,
      jobs: h.jobs,
      catalog: h.app.catalog,
      mailer: mail,
      webOrigin: 'http://localhost:3000',
      adminInbox,
    })
    return { mail, sweep }
  }
  const forget = () => h.db.delete(schema.platformAlerts)

  test('named, every alert goes to its addresses alone, and never to the admin’s own email', async () => {
    await forget()
    const inbox = ['alerts@example.test', 'oncall@example.test']
    const { mail, sweep } = alerts(inbox)
    expect((await sweep.sweep()).raised).toEqual(['catalog_stale'])
    expect(mail.sent.map((m) => m.to)).toEqual(inbox)
    expect(mail.to('oncall@example.test')[0]?.subject).toContain("mod catalog hasn't answered")
    expect(mail.to(adminEmail)).toEqual([])
    // Told: the next sweep writes to nobody.
    await sweep.sweep()
    expect(mail.sent).toHaveLength(2)
  })

  test('unset or empty, every admin hears at their own email, as before', async () => {
    for (const inbox of [undefined, []]) {
      await forget()
      const { mail, sweep } = alerts(inbox)
      expect((await sweep.sweep()).raised).toEqual(['catalog_stale'])
      expect(mail.sent.map((m) => m.to)).toEqual([adminEmail])
    }
  })
})
