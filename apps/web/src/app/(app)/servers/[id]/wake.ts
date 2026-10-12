// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

'use client'

/**
 * Waking a server from its pages: the overview's button and a resting world's settings. One press
 * is one wake, whatever happens to its request on the way, so the button never fails for something
 * the person didn't do:
 *
 * - A wake nobody answered (a deploy restarting the control plane, a phone that slept mid-request)
 *   is sent again with the same request id for about a minute, which the control plane takes as the
 *   same wake. Offline, it waits until the browser is back.
 * - A server still going to sleep, resting its world or taking a change can't wake yet: the press
 *   waits for that to finish and then wakes it, as a join at the edge does, rather than being
 *   refused for arriving a moment early.
 * - A wake whose answer was lost but which went through stops saying it failed once the page sees
 *   the server waking.
 *
 * What the button and the page show meanwhile is theirs (`page.tsx`, `settings/shared.tsx`).
 */
import type { ServerView } from '@blockly/contracts'
import { MINUTE_MS } from '@blockly/contracts/durations'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { codeOf, unanswered, useTRPC, useTRPCClient } from '../../../../lib/api'

/**
 * How often a wake nobody answered is sent again: at React Query's doubling delays, 1 s up to 30 s,
 * about a minute in all, which outlasts the control plane's API restarting for a deploy.
 */
const RESENDS = 6
/** How long a press waits for a server on its way somewhere before it gives up and says why. */
const SETTLE_MS = 10 * MINUTE_MS
/** How often it looks while it waits. */
const LOOK_EVERY_MS = 2_000

/** On its way somewhere a wake can't interrupt: the press waits for it to arrive. */
const BETWEEN: readonly ServerView['status'][] = [
  'stopping',
  'storing',
  'updating',
  'relocating',
  'provisioning',
]
/** Waking or awake already: the press is done once it sees one of these. */
const WAKING: readonly ServerView['status'][] = ['starting', 'running', 'restoring']

/** The two calls a wake makes, apart from React so the waiting can be tested on its own. */
export interface WakeCalls {
  start(input: { serverId: string; requestId: string }): Promise<ServerView>
  get(input: { serverId: string }): Promise<ServerView>
}

/**
 * One wake: asked for, and asked again each time the server refuses it only because it is still
 * on its way somewhere, until it arrives or `SETTLE_MS` runs out. The server as it last answered.
 */
export async function wake(
  calls: WakeCalls,
  input: { serverId: string; requestId: string },
  wait = (ms: number) => new Promise((done) => setTimeout(done, ms)),
  now = Date.now,
): Promise<ServerView> {
  const until = now() + SETTLE_MS
  for (;;) {
    try {
      return await calls.start(input)
    } catch (error) {
      if (codeOf(error) !== 'invalid_transition') throw error
      const view = await calls.get({ serverId: input.serverId })
      if (WAKING.includes(view.status)) return view
      if (!BETWEEN.includes(view.status) || now() >= until) throw error
      await wait(LOOK_EVERY_MS)
    }
  }
}

/** The wake mutation, for a page showing `view`: `mutateAsync({ serverId, requestId })`. */
export function useWakeRequest(view: Pick<ServerView, 'id' | 'status'>) {
  const trpc = useTRPC()
  const client = useTRPCClient()
  const queries = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input: { serverId: string; requestId: string }) =>
      wake({ start: (i) => client.servers.start.mutate(i), get: (i) => client.servers.get.query(i) }, input),
    retry: (failures, error) => unanswered(error) && failures < RESENDS,
    // Whatever became of it, the page asks where the server is now rather than trusting what it had.
    onError: () => queries.invalidateQueries({ queryKey: trpc.servers.get.queryKey({ serverId: view.id }) }),
  })
  const { isError, reset } = mutation
  // Its answer was lost, but the wake went through: nothing failed, so nothing says it did.
  useEffect(() => {
    if (isError && WAKING.includes(view.status)) reset()
  }, [isError, reset, view.status])
  return mutation
}
