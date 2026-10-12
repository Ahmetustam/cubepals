// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * How sure Blockly is that free accounts are one person's: main players, scores, groups. Asserted
 * through the tuning passed in, the default or one made for a test, never a deployment's own.
 */
import { describe, expect, test } from 'bun:test'
import { HOUR_S } from '@blockly/contracts/durations'
import {
  levelOf,
  linkedGroups,
  linkScore,
  mainPlayer,
  NO_SIGNALS,
  sameMain,
  signedUpClose,
} from './free-links.ts'
import { DEFAULT_FREE_LINK_TUNING, type FreeLinkTuning } from './tuning.ts'

const STEVE = '069a79f4-44e9-4726-a5be-fca90e38aaf5'
const ALEX = '1b2f6c1e-8f3a-4d2b-9c4e-5a6b7c8d9e0f'
const NAMED = '5627dd98-e6be-3c21-b8a8-e92344183641'
const hours = (entries: Record<string, number>) =>
  new Map(Object.entries(entries).map(([uuid, h]) => [uuid, h * HOUR_S]))

/** A tuning for these tests: round numbers, so what each threshold does is plain to read. */
const T: FreeLinkTuning = {
  ...DEFAULT_FREE_LINK_TUNING,
  weights: { mainPlayer: 1, inbox: 1, signedUpClose: 0.1, network: 0.1 },
  link: 0.3,
  medium: 0.6,
  high: 0.95,
  mainShare: 0.5,
  mainForS: HOUR_S,
}

describe('a server’s main player', () => {
  test('plays at least the main share of its verified play, the least time, and more than anyone', () => {
    expect(mainPlayer(hours({ [STEVE]: 3, [ALEX]: 1 }), T)).toEqual({ uuid: STEVE, share: 0.75 })
    expect(mainPlayer(hours({ [STEVE]: 2, [ALEX]: 2 }), T)).toBeNull()
    expect(mainPlayer(hours({ [STEVE]: 4, [ALEX]: 3, [NAMED]: 2 }), T)).toBeNull()
    expect(mainPlayer(hours({ [STEVE]: 0.5 }), T)).toBeNull()
    expect(mainPlayer(hours({ [STEVE]: 1 }), T)).toEqual({ uuid: STEVE, share: 1 })
    expect(mainPlayer(new Map(), T)).toBeNull()
    expect(mainPlayer(hours({ [STEVE]: 3, [ALEX]: 1 }), { ...T, mainShare: 0.8 })).toBeNull()
  })

  test('is a Minecraft account, never an offline-mode name', () => {
    expect(mainPlayer(hours({ [NAMED]: 5 }), T)).toBeNull()
  })
})

describe('a pair’s score', () => {
  test('is the weighted sum of its signals, held to 1', () => {
    expect(linkScore({ ...NO_SIGNALS, inbox: 1 }, T)).toBe(1)
    expect(linkScore({ ...NO_SIGNALS, mainPlayer: 0.5, network: 1 }, T)).toBeCloseTo(0.6)
    expect(linkScore({ mainPlayer: 1, inbox: 1, signedUpClose: 1, network: 1 }, T)).toBe(1)
    expect(linkScore({ ...NO_SIGNALS, network: 2 }, T)).toBeCloseTo(0.1)
  })

  test('one inbox is a sure link', () => {
    expect(levelOf(linkScore({ ...NO_SIGNALS, inbox: 1 }, T), T)).toBe('high')
  })

  test('one main player links, surer with more of the play on both', () => {
    const half = linkScore({ ...NO_SIGNALS, mainPlayer: sameMain(0.5, 0.5) }, T)
    expect(half).toBeGreaterThanOrEqual(T.link)
    expect(levelOf(half, T)).toBe('low')
    expect(levelOf(linkScore({ ...NO_SIGNALS, mainPlayer: sameMain(0.8, 0.8) }, T), T)).toBe('medium')
    expect(levelOf(linkScore({ ...NO_SIGNALS, mainPlayer: sameMain(1, 1) }, T), T)).toBe('high')
  })

  test('weak signals under the link threshold link nothing on their own, and add to others', () => {
    const weak = linkScore({ ...NO_SIGNALS, network: 1, signedUpClose: 1 }, T)
    expect(weak).toBeLessThan(T.link)
    const main = { ...NO_SIGNALS, mainPlayer: sameMain(0.5, 0.5) }
    expect(linkScore({ ...main, network: 1, signedUpClose: 1 }, T)).toBeGreaterThan(linkScore(main, T))
  })

  test('sign-ups count as close over the tuned span, falling off evenly', () => {
    const at = new Date('2026-10-01T12:00:00Z')
    const span = DEFAULT_FREE_LINK_TUNING.signedUpCloseMs
    expect(signedUpClose(at, at, DEFAULT_FREE_LINK_TUNING)).toBe(1)
    expect(signedUpClose(at, new Date(at.getTime() + span / 2), DEFAULT_FREE_LINK_TUNING)).toBeCloseTo(0.5)
    expect(signedUpClose(new Date(at.getTime() + span * 2), at, DEFAULT_FREE_LINK_TUNING)).toBe(0)
  })

  test('the levels follow the thresholds', () => {
    expect([
      levelOf(T.medium - 0.01, T),
      levelOf(T.medium, T),
      levelOf(T.high - 0.01, T),
      levelOf(T.high, T),
    ]).toEqual(['low', 'medium', 'medium', 'high'])
  })

  test('the default tuning keeps its thresholds in order', () => {
    const { link, medium, high } = DEFAULT_FREE_LINK_TUNING
    expect(link).toBeLessThan(medium)
    expect(medium).toBeLessThan(high)
  })
})

describe('groups', () => {
  const made = (...ids: string[]) => new Map(ids.map((id, i) => [id, new Date(2026, 0, i + 1)]))

  test('a group grows surer with each account that links into it, the first to sign up first', () => {
    const pair = linkScore({ ...NO_SIGNALS, mainPlayer: sameMain(0.8, 0.8) }, T)
    const [two] = linkedGroups([{ a: 'b', b: 'a', score: pair }], made('a', 'b', 'c'), T)
    expect(two).toMatchObject({ members: ['a', 'b'], level: 'medium' })
    const [three] = linkedGroups(
      [
        { a: 'b', b: 'a', score: pair },
        { a: 'c', b: 'b', score: pair },
        { a: 'c', b: 'a', score: pair },
      ],
      made('a', 'b', 'c'),
      T,
    )
    expect(three?.members).toEqual(['a', 'b', 'c'])
    // Two links join three accounts; the third, between two already joined, adds nothing.
    expect(three?.confidence).toBeCloseTo(1 - (1 - pair) ** 2)
    expect(three?.level).toBe('high')
  })

  test('pairs under the link threshold join nothing, and separate groups stay apart', () => {
    expect(linkedGroups([{ a: 'a', b: 'b', score: T.link - 0.01 }], made('a', 'b'), T)).toEqual([])
    const groups = linkedGroups(
      [
        { a: 'a', b: 'b', score: 1 },
        { a: 'c', b: 'd', score: T.medium },
      ],
      made('a', 'b', 'c', 'd'),
      T,
    )
    expect(groups.map((g) => [g.members, g.level])).toEqual([
      [['a', 'b'], 'high'],
      [['c', 'd'], 'medium'],
    ])
  })
})
