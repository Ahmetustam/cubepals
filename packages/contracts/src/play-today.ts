// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * A plan's daily play, said the same way wherever a player meets it: how much is left on the
 * server page, and when it is back there, on a start or a join that is refused, and in the server
 * list. The control plane works out the numbers; this only words them. It imports only the units
 * of time, which import nothing, so the edge agent compiles it in as it is (apps/edge/Dockerfile).
 */
import { MINUTE_MS } from './durations.ts'

/** "3 h 12 min", "45 min", "2 h": a stretch of play or of waiting, never less than a minute. */
export function hoursAndMinutes(minutes: number): string {
  const whole = Math.max(1, Math.round(minutes))
  const hours = Math.floor(whole / 60)
  const rest = whole % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/** How long until `backAt`, rounded up to the minute: "3 h 12 min". */
export const waitFor = (now: Date, backAt: Date): string =>
  hoursAndMinutes(Math.ceil((backAt.getTime() - now.getTime()) / MINUTE_MS))

/** "Back at midnight, in 3 h 12 min": when today's play is used up. */
export const backAtMidnight = (now: Date, backAt: Date): string =>
  `Back at midnight, in ${waitFor(now, backAt)}`
