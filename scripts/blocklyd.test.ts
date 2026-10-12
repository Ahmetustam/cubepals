// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test'
import { fetchRetrying } from './blocklyd.ts'

const url = 'https://github.com/cubepals/blocklyd/releases/download/v0.3.1/node-writes.openapi.json'

/** A fetch that gives each answer in turn, a thrown Error standing for a dropped connection. */
function answers(...queue: (number | Error)[]) {
  const calls: string[] = []
  const attempt = async (called: string) => {
    calls.push(called)
    const next = queue.shift()
    if (next === undefined) throw new Error('asked once too often')
    if (next instanceof Error) throw next
    return new Response(String(next), { status: next })
  }
  return { calls, attempt }
}

describe('fetchRetrying', () => {
  test('a 504, a 429 and a dropped connection are tried again, with growing waits', async () => {
    const { calls, attempt } = answers(504, 429, new Error('socket hang up'), 200)
    const waits: number[] = []
    const response = await fetchRetrying(url, {}, attempt, async (ms) => waits.push(ms))
    expect(response.status).toBe(200)
    expect(calls).toEqual([url, url, url, url])
    expect(waits).toEqual([2000, 5000, 15000])
  })

  test('a 404 returns at once, for the caller to say the release is missing', async () => {
    const { calls, attempt } = answers(404)
    const waits: number[] = []
    const response = await fetchRetrying(url, {}, attempt, async (ms) => waits.push(ms))
    expect(response.status).toBe(404)
    expect(calls).toHaveLength(1)
    expect(waits).toEqual([])
  })

  test('after the last wait, the last answer is the answer, failure or not', async () => {
    const { attempt } = answers(502, 502, 502, 503)
    const response = await fetchRetrying(url, {}, attempt, async () => {})
    expect(response.status).toBe(503)
    const dropped = answers(500, 500, 500, new Error('reset'))
    await expect(fetchRetrying(url, {}, dropped.attempt, async () => {})).rejects.toThrow('reset')
  })
})
