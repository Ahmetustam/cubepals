// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * An island server's World page: each player's island lives in a world of BentoBox's own, so a new
 * world of Cubepals' would change only the plain world beside them. Neither a fresh world nor one
 * made by hand is offered or made; how a player starts their island over is said instead.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { Cdn } from '../../testing/cdn.ts'
import { type Harness, hasDatabase, startHarness } from '../../testing/harness.ts'

describe.skipIf(!hasDatabase)('an island server’s worlds', () => {
  let h: Harness
  const cdn = new Cdn()

  beforeAll(async () => {
    await cdn.start()
    h = await startHarness()
  }, 30_000)

  afterAll(async () => {
    await h.close()
    cdn.close()
  })

  const plugin = (projectId: string, name: string) =>
    h.catalog.publish(
      {
        projectId,
        slug: projectId,
        name,
        summary: '',
        iconUrl: null,
        environments: ['server_only'],
        downloads: 1,
      },
      [
        {
          versionId: `${projectId}-1`,
          projectId,
          versionLabel: '1.0',
          channel: 'release',
          state: 'listed',
          environment: 'server_only',
          loaders: ['paper'],
          gameVersions: ['26.2'],
          publishedAt: new Date(Date.UTC(2026, 0, 1)),
          file: cdn.file(`${projectId}-1`),
          dependencies: [],
        },
      ],
    )

  test('a Skyblock server offers no new world, and says how a player starts their island over', async () => {
    plugin('aBVLHiAW', 'BentoBox')
    plugin('ASGn77Qd', 'BSkyBlock')
    plugin('OWzL9XSJ', 'Level')
    plugin('P08aFayx', 'Warps')
    const owner = await h.user('Ida', 'plus')
    const server = await h.create(owner, { from: { kind: 'template', key: 'skyblock' } })
    await h.until(server.id, 'running')
    await h.settled(server.id)

    expect(await h.app.worldQueries.freshStart(owner, server.id)).toMatchObject({
      kind: 'islands',
      islands: { mode: 'Skyblock', reset: '/island reset' },
    })
    const refusal =
      'Each player’s Skyblock island lives in a world of its own, so a new world wouldn’t change it. A player starts their island over in the game with /island reset.'
    await expect(h.app.worlds.freshStart(owner, server.id, randomUUID())).rejects.toThrow(refusal)
    const made = h.app.worlds.createWorld(
      owner,
      server.id,
      { name: 'Flat', levelType: 'minecraft:flat', hardcore: false },
      randomUUID(),
    )
    await expect(made).rejects.toThrow(refusal)
  }, 30_000)
})
