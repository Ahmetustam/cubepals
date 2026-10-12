// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test'
import { backAtMidnight, hoursAndMinutes, waitFor } from '@blockly/contracts/play-today'

const at = (iso: string) => new Date(iso)

describe('when play is back', () => {
  test('is said in hours and minutes, never less than a minute', () => {
    const now = at('2026-10-12T20:48:00Z')
    expect(waitFor(now, at('2026-10-13T00:00:00Z'))).toBe('3 h 12 min')
    expect(waitFor(now, at('2026-10-12T21:48:00Z'))).toBe('1 h')
    expect(waitFor(now, at('2026-10-12T21:33:00Z'))).toBe('45 min')
    expect(waitFor(now, now)).toBe('1 min')
    expect(backAtMidnight(now, at('2026-10-13T00:00:00Z'))).toBe('Back at midnight, in 3 h 12 min')
  })

  test('what is left of the day is said the same way', () => {
    expect(hoursAndMinutes(120)).toBe('2 h')
    expect(hoursAndMinutes(80)).toBe('1 h 20 min')
    expect(hoursAndMinutes(0.4)).toBe('1 min')
  })
})
