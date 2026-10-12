// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * One press of the wake button against a server that answers in order: what it waits for, what it
 * asks again with the same request id, and what it gives up on and says.
 */

import { describe, expect, test } from 'bun:test'
import type { ServerView } from '@blockly/contracts'
import { MINUTE_MS } from '@blockly/contracts/durations'
import { refusing } from '@blockly/control/testing/refusing'
import { failedWith } from '../../../../lib/failed-call.ts'
import { wake } from './wake'

const serverId = '6258d5d3-f767-4c18-bb3d-67987e778d91'
const requestId = '0a6f3a43-0d0e-4a43-9d25-1c4b7a8f0e11'
const view = (status: ServerView['status']) => ({ id: serverId, status }) as ServerView
const notNow = await failedWith(
  refusing('invalid_transition', 'Your server is stopping. Try this once it has.'),
)

/** The server's answers in order, each a view or a refusal, and the starts it was asked for. */
function server(starts: Array<ServerView | Error>, gets: ServerView[]) {
  const asked: string[] = []
  return {
    asked,
    calls: {
      start: async (input: { requestId: string }) => {
        asked.push(input.requestId)
        const next = starts.shift()
        if (next === undefined) throw new Error('asked to start once too often')
        if (next instanceof Error) throw next
        return next
      },
      get: async () => {
        const next = gets.shift()
        if (next === undefined) throw new Error('asked where it is once too often')
        return next
      },
    },
  }
}

/** A clock the waits move on, so a ten-minute wait takes no time. */
function clock() {
  let at = 0
  return {
    wait: async (ms: number) => {
      at += ms
    },
    now: () => at,
  }
}

describe('one press of the wake button', () => {
  test('a sleeping server is simply woken', async () => {
    const { calls, asked } = server([view('starting')], [])
    expect((await wake(calls, { serverId, requestId })).status).toBe('starting')
    expect(asked).toEqual([requestId])
  })

  test('a server still going to sleep is woken once it is asleep, with the same request', async () => {
    const t = clock()
    const { calls, asked } = server([notNow, notNow, view('starting')], [view('stopping'), view('stopping')])
    expect((await wake(calls, { serverId, requestId }, t.wait, t.now)).status).toBe('starting')
    expect(asked).toEqual([requestId, requestId, requestId])
    expect(t.now()).toBe(4_000)
  })

  test('a world still being put to rest is woken from its rest once it is there', async () => {
    const t = clock()
    const { calls } = server([notNow, view('restoring')], [view('storing')])
    expect((await wake(calls, { serverId, requestId }, t.wait, t.now)).status).toBe('restoring')
  })

  test('a server another tab or a join woke meanwhile is done, not refused', async () => {
    const { calls, asked } = server([notNow], [view('running')])
    expect((await wake(calls, { serverId, requestId })).status).toBe('running')
    expect(asked).toHaveLength(1)
  })

  test('a refusal that waiting can’t help is said at once', async () => {
    const used = await failedWith(
      refusing('limit_reached', 'You have used this month’s play time. It resets on the 1st.'),
    )
    await expect(wake(server([used], []).calls, { serverId, requestId })).rejects.toBe(used)
    // Failed, and staying so: the reason is the server's, and waiting changes nothing.
    await expect(wake(server([notNow], [view('failed')]).calls, { serverId, requestId })).rejects.toBe(notNow)
  })

  test('a server that never gets there is given up on after ten minutes, with its reason', async () => {
    const t = clock()
    const starts = Array.from({ length: 400 }, () => notNow)
    const gets = Array.from({ length: 400 }, () => view('stopping'))
    await expect(wake(server(starts, gets).calls, { serverId, requestId }, t.wait, t.now)).rejects.toBe(
      notNow,
    )
    expect(t.now()).toBe(10 * MINUTE_MS)
  })
})
