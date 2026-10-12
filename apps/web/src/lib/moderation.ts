// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { ModerationStep } from '@blockly/contracts'
/** Warnings, mutes and bans in a person's words: "Mute for 1 day", "Ban for good". */
import { DAY_MS, HOUR_MS, MINUTE_MS } from '@blockly/contracts/durations'

const DAY_MINUTES = DAY_MS / MINUTE_MS
const HOUR_MINUTES = HOUR_MS / MINUTE_MS

const count = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

/** How long a mute or ban lasts: "1 hour", "7 days", or "For good". */
export function lengthLabel(minutes: number | null): string {
  if (minutes === null) return 'For good'
  if (minutes % DAY_MINUTES === 0) return count(minutes / DAY_MINUTES, 'day')
  if (minutes % HOUR_MINUTES === 0) return count(minutes / HOUR_MINUTES, 'hour')
  return count(minutes, 'minute')
}

export function stepLabel(step: ModerationStep): string {
  if (step.kind === 'warn') return 'Warning'
  const what = step.kind === 'mute' ? 'Mute' : 'Ban'
  return step.minutes === null ? `${what} for good` : `${what} for ${lengthLabel(step.minutes)}`
}
