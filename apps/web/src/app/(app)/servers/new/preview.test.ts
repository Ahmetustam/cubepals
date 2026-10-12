// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The create page's question before a choice counts as picked: what the choice would make, and
 * the version a template lands on when the one picked for another can't run it.
 */
import { describe, expect, test } from 'bun:test'
import type { SetupPreview, SetupSourceInput } from '@blockly/contracts'
import { refusing } from '@blockly/control/testing/refusing'
import { failedWith } from '../../../../lib/failed-call.ts'
import { previewOf } from './preview.ts'

/**
 * The control plane as the create page asks it, by what it was asked for: Skyblock runs on 26.2
 * and the 1.21 releases from 1.21.8, not on 1.21.1, as Modrinth listed its plugins on 2026-10-11.
 */
function controlPlane(fails: (from: SetupSourceInput) => Error | null) {
  const asked: SetupSourceInput[] = []
  const trpc = { servers: { setupPreview: { queryOptions: (input: { from: SetupSourceInput }) => input } } }
  const queries = {
    query: async ({ from }: { from: SetupSourceInput }) => {
      asked.push(from)
      const failure = fails(from)
      if (failure !== null) throw failure
      const gameVersion = from.kind === 'template' ? (from.gameVersion ?? '26.2') : '26.2'
      return { from: 'Skyblock', gameVersion } as SetupPreview
    },
  }
  return { asked, queries: queries as never, trpc: trpc as never }
}

const notOn121 = await failedWith(
  refusing(
    'mods_conflict',
    "Cubepals can't run SkyBlock (BSkyBlock) on Minecraft 1.21.1. Skyblock runs on Minecraft 26.2.",
  ),
)
const onlyOn121 = (from: SetupSourceInput) =>
  from.kind === 'template' && from.gameVersion === '1.21.1' ? notOn121 : null

describe('what a choice on the create page would make', () => {
  test('a version picked for another template stays where this one runs on it', async () => {
    const { asked, queries, trpc } = controlPlane(onlyOn121)
    const picked = { kind: 'template', key: 'skyblock', gameVersion: '1.21.11' } as const
    const { source, would } = await previewOf(queries, trpc, picked, '5')
    expect(source).toEqual(picked)
    expect(would.gameVersion).toBe('1.21.11')
    expect(asked).toEqual([picked])
  })

  test('a template that can’t run on the version picked lands on the newest it runs on', async () => {
    // Production, 2026-10-11: a version picked earlier came along, and Skyblock was refused
    // with "can't run SkyBlock (BSkyBlock) on any Minecraft it offers".
    const { asked, queries, trpc } = controlPlane(onlyOn121)
    const { source, would } = await previewOf(
      queries,
      trpc,
      { kind: 'template', key: 'skyblock', gameVersion: '1.21.1' },
      '5',
    )
    expect(source).toEqual({ kind: 'template', key: 'skyblock' })
    expect(would.gameVersion).toBe('26.2')
    expect(asked).toHaveLength(2)
  })

  test('a template whose server type isn’t offered on the version picked lands on the newest too', async () => {
    // Survival picked on 26.3, then Smoother survival: Paper has no build Cubepals offers for 26.3.
    const noPaper = await failedWith(
      refusing('invalid_choice', 'Cubepals doesn’t offer Paper on Minecraft 26.3 yet.'),
    )
    const { source, would } = await previewOf(
      controlPlane((from) => (from.kind === 'template' && from.gameVersion === '26.3' ? noPaper : null))
        .queries,
      controlPlane(() => null).trpc,
      { kind: 'template', key: 'smooth', gameVersion: '26.3' },
      '5',
    )
    expect(source).toEqual({ kind: 'template', key: 'smooth' })
    expect(would.gameVersion).toBe('26.2')
  })

  test('what can’t run at all, or fails another way, is the answer as it came', async () => {
    const nowhere = await failedWith(
      refusing(
        'mods_conflict',
        "Cubepals can't run SkyBlock (BSkyBlock) on any Minecraft it offers right now.",
      ),
    )
    const away = await failedWith(refusing('catalog_unavailable', 'Modrinth isn’t answering right now.'))
    for (const [fails, from] of [
      [nowhere, { kind: 'template', key: 'skyblock' }],
      [away, { kind: 'template', key: 'skyblock', gameVersion: '1.21.1' }],
      [nowhere, { kind: 'modpack', projectId: 'pack' }],
    ] as const) {
      const { asked, queries, trpc } = controlPlane(() => fails)
      await expect(previewOf(queries, trpc, from, '5')).rejects.toBe(fails)
      expect(asked).toEqual([from])
    }
  })
})
