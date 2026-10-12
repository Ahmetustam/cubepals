// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { PartySize, SetupPreview, SetupSourceInput } from '@blockly/contracts'
import type { QueryClient } from '@tanstack/react-query'
import { codeOf, type useTRPC } from '../../../../lib/api'

/**
 * What a choice would make, and the choice that makes it. A version someone picked comes along to
 * each template they look at; one that can't run on it is asked for without, so it lands on the
 * newest release it runs on, and the bar says why.
 */
export async function previewOf(
  queries: Pick<QueryClient, 'query'>,
  trpc: ReturnType<typeof useTRPC>,
  asked: SetupSourceInput,
  partySize: PartySize,
): Promise<{ source: SetupSourceInput; would: SetupPreview }> {
  const ask = (from: SetupSourceInput) =>
    queries.query(trpc.servers.setupPreview.queryOptions({ from, partySize }))
  try {
    return { source: asked, would: await ask(asked) }
  } catch (error) {
    // Its mods don't run on that release, or its server type isn't offered there.
    const refused = codeOf(error) === 'mods_conflict' || codeOf(error) === 'invalid_choice'
    if (asked.kind !== 'template' || asked.gameVersion === undefined || !refused) throw error
    const newest = { kind: 'template', key: asked.key } as const
    return { source: newest, would: await ask(newest) }
  }
}
