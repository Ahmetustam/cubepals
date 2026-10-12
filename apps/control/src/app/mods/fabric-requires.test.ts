// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * What a Fabric mod's own jar requires, which the catalog may not list: planned with the mod, or
 * the plan refused, so a change never rolls back over a mod Fabric stops at boot. Found on staging
 * (2026-10-11): spark's Fabric build, which Modrinth lists with no dependency, was planned without
 * Fabric API, and its start stopped on "spark needs fabric-api-base".
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { CatalogVersion } from '../../domain/mods/catalog.ts'
import { Cdn } from '../../testing/cdn.ts'
import { type Harness, hasDatabase, startHarness } from '../../testing/harness.ts'
import { utf8, zipBytes } from '../../testing/uploads.ts'
import { loadRevision } from '../servers/persistence.ts'

describe.skipIf(!hasDatabase)('the mods a Fabric jar requires', () => {
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

  /** A Fabric mod's jar: its fabric.mod.json, and the entry class it names, built for Java 25. */
  const fabricMod = (modId: string, depends: Record<string, string>) =>
    zipBytes({
      'fabric.mod.json': utf8(JSON.stringify({ id: modId, entrypoints: { main: ['a.Mod'] }, depends })),
      'a/Mod.class': Uint8Array.from(Buffer.from('cafebabe00000045', 'hex')),
    })

  /** A project with one version, its jar on the CDN, listing no dependency at all. */
  const publish = (projectId: string, name: string, versionId: string, jar: Uint8Array) =>
    h.catalog.publish(
      {
        projectId,
        slug: projectId,
        name,
        summary: `${name}, for tests`,
        iconUrl: null,
        environments: ['server_only'],
        downloads: 1,
      },
      [
        {
          versionId,
          projectId,
          versionLabel: versionId,
          channel: 'release',
          state: 'listed',
          environment: 'server_only',
          loaders: ['fabric'],
          gameVersions: ['26.3'],
          publishedAt: new Date('2026-10-01'),
          file: cdn.file(versionId, jar),
          dependencies: [],
        } satisfies CatalogVersion,
      ],
    )

  test('a plain server’s first mod brings Fabric API with it, as its jar requires', async () => {
    // Fabric API by its Modrinth id, and spark's Fabric build as Modrinth lists it.
    publish('P7dR8mSH', 'Fabric API', 'fabric-api-1', fabricMod('fabric-api', {}))
    publish('spark', 'spark', 'spark-1', fabricMod('spark', { fabricloader: '*', 'fabric-api-base': '*' }))
    const owner = await h.user('Steve', 'plus')
    const { id } = await h.create(owner, { loader: 'vanilla' })
    await h.until(id, 'running')
    await h.settled(id)

    const add = { add: [{ projectId: 'spark' }] }
    const plan = await h.app.mods.plan(owner, id, add)
    if (plan.kind !== 'ok') throw new Error(`Conflicts: ${JSON.stringify(plan.conflicts)}`)
    expect([plan.loader, plan.added.map((m) => [m.name, m.origin, m.requiredBy])]).toEqual([
      'fabric',
      [
        ['Fabric API', 'dependency', ['spark']],
        ['spark', 'user', []],
      ],
    ])
    const before = await h.server(id)
    await h.app.mods.apply(
      owner,
      id,
      add,
      plan.mods.map((m) => m.artifact.sha512),
      randomUUID(),
    )
    await h.until(id, (s) => s.lifecycle.status === 'running' && s.version > before.version + 1, 20_000)
    await h.settled(id, 20_000)
    const revision = await loadRevision(h.db, (await h.server(id)).desiredRevisionId)
    expect([revision.loader, revision.mods.map((m) => m.name)]).toEqual(['fabric', ['Fabric API', 'spark']])
  }, 40_000)

  test('a mod whose jar requires one nothing provides is refused, naming it', async () => {
    publish('needs-cloth', 'Needs Cloth', 'needs-cloth-1', fabricMod('needs-cloth', { 'cloth-config': '*' }))
    const owner = await h.user('Alex', 'plus')
    const { id } = await h.create(owner, { loader: 'fabric' })
    await h.until(id, 'running')
    await h.settled(id)
    expect(await h.app.mods.plan(owner, id, { add: [{ projectId: 'needs-cloth' }] })).toMatchObject({
      kind: 'conflicts',
      conflicts: [{ kind: 'missing_dependency', mod: 'Needs Cloth', dependency: 'cloth-config' }],
    })
  })
})
