// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test'
import { sessionName } from './session-names'

describe('a session of play, named', () => {
  // Monday 12 October 2026, 21:30 in Paris (UTC+2).
  const now = Date.parse('2026-10-12T19:30:00Z')
  const named = (at: string, zone = 'Europe/Paris') => sessionName(at, now, zone)

  test('today and yesterday by the part of the day', () => {
    expect(named('2026-10-12T07:00:00Z')).toEqual({ label: 'This morning', phrase: 'this morning' })
    expect(named('2026-10-12T18:10:00Z').label).toBe('This evening')
    expect(named('2026-10-11T16:45:00Z')).toEqual({ label: 'Yesterday evening', phrase: 'yesterday evening' })
    expect(named('2026-10-11T13:00:00Z').label).toBe('Yesterday afternoon')
  })

  test('play past midnight is the night before’s', () => {
    // 01:40 on Monday in Paris.
    expect(named('2026-10-11T23:40:00Z')).toEqual({ label: 'Last night', phrase: 'last night' })
    // Still tonight at 01:00 on Tuesday.
    expect(
      sessionName('2026-10-12T21:00:00Z', Date.parse('2026-10-12T23:00:00Z'), 'Europe/Paris').label,
    ).toBe('Tonight')
  })

  test('this week by its weekday, before that by its date', () => {
    expect(named('2026-10-10T18:00:00Z')).toEqual({
      label: 'Saturday evening',
      phrase: 'on Saturday evening',
    })
    expect(named('2026-10-03T10:00:00Z')).toEqual({
      label: 'Afternoon of 3 October',
      phrase: 'on the afternoon of 3 October',
    })
  })

  test('where the owner is, not where the server runs', () => {
    // 18:10 UTC is the evening in Paris and the afternoon in New York.
    expect(named('2026-10-12T18:10:00Z', 'America/New_York').label).toBe('This afternoon')
  })
})
