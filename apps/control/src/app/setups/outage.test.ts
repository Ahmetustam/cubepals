// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Modrinth not answering while a pack is picked or a server made from it (§15.3): the create page
 * is told so, in words, and nothing is made or kept about the pack.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { schema } from '@blockly/db'
import { eq } from 'drizzle-orm'
import { type Harness, hasDatabase, startHarness } from '../../testing/harness.ts'

describe.skipIf(!hasDatabase)('a catalog outage while a pack is picked', () => {
  let h: Harness

  beforeAll(async () => {
    h = await startHarness()
  }, 30_000)

  afterAll(async () => {
    await h.close()
  })

  test('says Modrinth isn’t answering, and makes nothing', async () => {
    h.catalog.publishModpack(
      {
        projectId: 'outage-pack',
        slug: 'outage-pack',
        name: 'Outage Pack',
        summary: 'Outage Pack, for tests',
        iconUrl: null,
        environments: [],
        downloads: 1,
        categories: [],
      },
      [],
    )
    const owner = await h.user('Remy', 'plus')
    const said = {
      code: 'catalog_unavailable',
      message: 'Modrinth isn’t answering right now. Try again in a minute.',
    }
    h.catalog.outage(true)
    try {
      const from = { kind: 'modpack' as const, projectId: 'outage-pack' }
      await expect(h.app.queries.setupPreview(owner, from)).rejects.toMatchObject(said)
      await expect(h.create(owner, { name: 'Outage', from })).rejects.toMatchObject(said)
    } finally {
      h.catalog.outage(false)
    }
    const made = await h.db
      .select()
      .from(schema.minecraftServers)
      .where(eq(schema.minecraftServers.ownerId, owner.userId))
    expect(made).toEqual([])
    expect(await h.app.setups.unchecked(['outage-pack'])).toEqual(['outage-pack'])
  })
})
