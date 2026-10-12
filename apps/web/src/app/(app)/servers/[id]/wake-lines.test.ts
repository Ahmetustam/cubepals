// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/** The pacing rule of a wake's log: what it says next, and what it says while nothing is said. */

import { describe, expect, test } from 'bun:test'
import { KEPT, type Line, nextLines, QUIET_MS, STILL_MS } from './wake-lines.ts'

const step = (before: Line[], heard: string | undefined, at: number, quiet = 'Setting it up', shownAt = 0) =>
  nextLines(before, heard === undefined ? undefined : { text: heard }, { quiet, waking: true, at, shownAt })
const texts = (lines: Line[] | null) => lines?.map((line) => line.text)

describe('which line a wake shows next', () => {
  test('it starts with what the step is doing, and what the server says goes under it', () => {
    const first = step([], undefined, 0) ?? []
    expect(texts(first)).toEqual(['Setting it up'])
    expect(texts(step(first, 'Starting Minecraft 26.3', 1_000))).toEqual([
      'Setting it up',
      'Starting Minecraft 26.3',
    ])
  })

  test('quiet words follow the step, then say it is still at it', () => {
    const first = step([], undefined, 0) ?? []
    // The step moved on: the quiet words change in place.
    const moved = step(first, undefined, 1_000, 'Loading the world')
    expect(texts(moved)).toEqual(['Loading the world'])
    expect(moved?.[0]?.key).toBe(first[0]?.key)
    expect(step(moved ?? [], undefined, 1_000 + STILL_MS - 1, 'Loading the world')).toBeNull()
    expect(texts(step(moved ?? [], undefined, 2_000 + STILL_MS, 'Loading the world'))).toEqual([
      'Still loading the world',
    ])
  })

  test('silence after a line brings the quiet words back, unless the line said them already', () => {
    const said: Line[] = [{ text: 'Starting Paper for Minecraft 1.21.11', key: 1, at: 0 }]
    expect(step(said, undefined, QUIET_MS - 1, 'Starting Minecraft 1.21.11')).toBeNull()
    expect(texts(step(said, undefined, QUIET_MS + 1, 'Starting Minecraft 1.21.11'))?.at(-1)).toBe(
      'Starting Minecraft 1.21.11',
    )
    const same: Line[] = [{ text: 'Starting Minecraft', key: 1, at: 0 }]
    expect(step(same, undefined, QUIET_MS + 1, 'Starting Minecraft 26.3')).toBeNull()
    expect(texts(step(same, undefined, STILL_MS + 1, 'Starting Minecraft 26.3'))?.at(-1)).toBe(
      'Still starting Minecraft 26.3',
    )
  })

  test('a line already in view is not said twice', () => {
    const quiet: Line[] = [{ text: 'Starting Minecraft 1.21.11', key: 1, at: 0, quiet: true, group: 'quiet' }]
    expect(step(quiet, 'Starting Minecraft 1.21.11', 1_000, 'Starting Minecraft 1.21.11')).toBeNull()
  })

  test('a count takes the place of the one before it, and only the newest few are kept', () => {
    const spawn = (percent: number) => ({
      text: `Getting the spawn area ready · ${percent}%`,
      group: 'spawn',
    })
    const at42 = nextLines([], spawn(42), { quiet: 'x', waking: true, at: 0, shownAt: 0 }) ?? []
    const at84 = nextLines(at42, spawn(84), { quiet: 'x', waking: true, at: 1, shownAt: 0 }) ?? []
    expect(texts(at84)).toEqual(['Getting the spawn area ready · 84%'])
    let lines: Line[] = []
    for (let i = 0; i < KEPT + 3; i++) lines = step(lines, `line ${i}`, i) ?? lines
    expect(texts(lines)).toEqual(['line 3', 'line 4', 'line 5', 'line 6'])
  })

  test('once it is over, nothing is said for the quiet', () => {
    expect(nextLines([], undefined, { quiet: 'Setting it up', waking: false, at: 0, shownAt: 0 })).toBeNull()
  })
})
