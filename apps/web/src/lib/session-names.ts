// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * A session of play named as a person says it, in the owner's time zone: "This evening", "Last
 * night", "Saturday afternoon", "Evening of 3 October". It names when; which backups are sessions
 * is the backups page's to say.
 */
import { DAY_MS } from '@blockly/contracts/durations'

type Part = 'morning' | 'afternoon' | 'evening' | 'night'

/** Play past midnight, until five, is still the night before's. */
const NIGHT_ENDS = 5

const partOf = (hour: number): Part =>
  hour < NIGHT_ENDS || hour >= 22 ? 'night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

/** The session's day, as a UTC midnight, and its part of the day, where `zone` is. */
function sessionOf(ms: number, zone: string | undefined): { day: number; part: Part } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(ms)
  const field = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value)
  const hour = field('hour')
  const day = Date.UTC(field('year'), field('month') - 1, field('day'))
  return { day: hour < NIGHT_ENDS ? day - DAY_MS : day, part: partOf(hour) }
}

const TODAY: Record<Part, string> = {
  morning: 'This morning',
  afternoon: 'This afternoon',
  evening: 'This evening',
  night: 'Tonight',
}
const YESTERDAY: Record<Part, string> = {
  morning: 'Yesterday morning',
  afternoon: 'Yesterday afternoon',
  evening: 'Yesterday evening',
  night: 'Last night',
}

/**
 * The session a moment belongs to: `label` to show on its own, and `phrase` to finish "how it
 * was …". `zone` is an IANA time zone; without one, the browser's own.
 */
export function sessionName(
  at: string,
  now: number,
  zone: string | undefined,
): { label: string; phrase: string } {
  const then = sessionOf(Date.parse(at), zone)
  const days = Math.round((sessionOf(now, zone).day - then.day) / DAY_MS)
  if (days <= 1) {
    const label = (days <= 0 ? TODAY : YESTERDAY)[then.part]
    return { label, phrase: label.charAt(0).toLowerCase() + label.slice(1) }
  }
  if (days < 7) {
    const weekday = new Date(then.day).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
    const label = `${weekday} ${then.part}`
    return { label, phrase: `on ${label}` }
  }
  const date = new Date(then.day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
  return {
    label: `${then.part.charAt(0).toUpperCase()}${then.part.slice(1)} of ${date}`,
    phrase: `on the ${then.part} of ${date}`,
  }
}
