// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The create button's press: sent again while nothing answers it, and the same request however
 * often it is pressed before an answer, from a reload, another tab or going back.
 */
import { beforeEach, describe, expect, test } from 'bun:test'
import { MINUTE_MS } from '@blockly/contracts/durations'
import { refusing } from '@blockly/control/testing/refusing'
import { failedWith } from '../../../../lib/failed-call.ts'
import { answered, cutShort, press, retryCreate, retryDelay, unanswered } from './sending.ts'

/** The browser's storage, as its tabs share it. */
const stored = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    getItem: (name: string) => stored.get(name) ?? null,
    setItem: (name: string, value: string) => void stored.set(name, value),
    removeItem: (name: string) => void stored.delete(name),
  },
})

const asked = {
  name: 'Sunset Valley',
  from: { kind: 'template' as const, key: 'skyblock' },
  partySize: '5' as const,
  regionKey: 'fra',
}
const at = Date.UTC(2026, 9, 11, 12)

const noAnswer = await failedWith(() => Promise.reject(new TypeError('Failed to fetch')))
const refusal = await failedWith(refusing('limit_reached', 'Your plan includes 1 server.'))

describe('a create press', () => {
  beforeEach(() => stored.clear())

  test('no answer is sent again a few times; a refusal is said at once', () => {
    expect(unanswered(noAnswer)).toBe(true)
    expect(unanswered(refusal)).toBe(false)
    expect(retryCreate(0, refusal)).toBe(false)
    const tries = [0, 1, 2, 3, 4, 5, 6, 7]
    expect(tries.map((failures) => retryCreate(failures, noAnswer))).toEqual([
      ...tries.slice(1).map(() => true),
      false,
    ])
    const waits = tries.slice(0, -1).map(retryDelay)
    expect(waits).toEqual([1000, 2000, 4000, 8000, 8000, 8000, 8000])
  })

  test('pressed again before an answer, after a reload or in another tab, it is the same request', () => {
    const first = press(asked, at)
    expect(press(asked, at + 30_000).idempotencyKey).toBe(first.idempotencyKey)
  })

  test('another request, or the same one once answered or long after, is a new server', () => {
    const first = press(asked, at)
    const renamed = press({ ...asked, name: 'Moonrise' }, at)
    expect(renamed.idempotencyKey).not.toBe(first.idempotencyKey)

    const sent = press(asked, at)
    answered(sent)
    expect(press(asked, at).idempotencyKey).not.toBe(sent.idempotencyKey)

    const later = press(asked, at)
    expect(press(asked, at + 11 * MINUTE_MS).idempotencyKey).not.toBe(later.idempotencyKey)
  })

  test('a press a reload cut short is sent again as the page opens, not on a later visit', () => {
    expect(cutShort(at)).toBeNull()
    const sent = press(asked, at)
    expect(cutShort(at + 5_000)).toEqual(sent)
    expect(cutShort(at + 3 * MINUTE_MS)).toBeNull()
    answered(sent)
    expect(cutShort(at + 5_000)).toBeNull()
  })

  test('an answer to an older press leaves the newer one remembered', () => {
    const old = press(asked, at)
    const newer = press({ ...asked, name: 'Moonrise' }, at)
    answered(old)
    expect(cutShort(at)).toEqual(newer)
  })

  test('where the browser keeps nothing, the tab remembers the press', () => {
    const storage = globalThis.localStorage
    Object.assign(globalThis, {
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError')
        },
        setItem: () => {
          throw new Error('SecurityError')
        },
        removeItem: () => {},
      },
    })
    try {
      const first = press(asked, at)
      expect(press(asked, at + 1_000).idempotencyKey).toBe(first.idempotencyKey)
    } finally {
      Object.assign(globalThis, { localStorage: storage })
    }
  })
})
