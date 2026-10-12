// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Which line a waking server's log shows next (wake-log.tsx draws it): the next one the server
 * said that isn't in view already, or, while it says nothing, what it is doing in words, and
 * after a long while that it is still at it. Pure, so the pacing that reads it is the only clock.
 */

import type { WakeWords } from '../../../../lib/wake-words'

/** How long the server may say nothing before the newest line says, in words, what it is doing. */
export const QUIET_MS = 6_000
/** How long the same quiet words stay before they say it is still at it. */
export const STILL_MS = 12_000
/** Lines drawn: three in view, and the one leaving above them. */
export const KEPT = 4

export interface Line extends WakeWords {
  key: number
  /** Words Blockly put there while the server said nothing. */
  quiet?: boolean
  /** When it was first shown, for quiet words to become "Still …". */
  at: number
}

/**
 * The lines after one more step, given the next line heard, if any; null where nothing changes.
 * `quiet` is what the wake's step is doing in words; `shownAt` when a line last changed.
 */
export function nextLines(
  before: Line[],
  heard: WakeWords | undefined,
  { quiet, waking, at, shownAt }: { quiet: string; waking: boolean; at: number; shownAt: number },
): Line[] | null {
  const newest = before.at(-1)
  // What the quiet words already said in view, the server saying it too adds nothing.
  if (heard !== undefined && before.some((line) => line.text === heard.text)) return null
  const quietly = heard === undefined && waking ? quietWords(newest, quiet, at, shownAt) : undefined
  const words: (WakeWords & { quiet?: boolean }) | undefined =
    heard ?? (quietly === undefined ? undefined : { text: quietly, group: 'quiet', quiet: true })
  if (words === undefined) return null
  // A line of the same group as the newest ("Getting the spawn area ready · 42%") takes its place,
  // and "Still …" keeps the time the quiet words it follows were first shown.
  if (newest !== undefined && words.group !== undefined && words.group === newest.group) {
    const kept = words.text.startsWith('Still ') ? newest.at : at
    return [...before.slice(0, -1), { ...words, key: newest.key, at: kept }]
  }
  return [...before, { ...words, key: (newest?.key ?? 0) + 1, at }].slice(-KEPT)
}

/**
 * What to say while the server says nothing, if anything: the step's words, following the step
 * as it moves, then "Still …" once they have stood a while. A line that already says what the
 * quiet words would ("Starting Minecraft") isn't followed by them.
 */
function quietWords(
  newest: Line | undefined,
  quiet: string,
  at: number,
  shownAt: number,
): string | undefined {
  const still = `Still ${lower(quiet)}`
  if (newest === undefined) return quiet
  if (newest.quiet) {
    if (newest.text !== quiet && newest.text !== still) return quiet
    return newest.text === quiet && at - newest.at > STILL_MS ? still : undefined
  }
  if (at - shownAt <= QUIET_MS) return undefined
  if (!saysAlready(newest.text, quiet)) return quiet
  return at - newest.at > STILL_MS ? still : undefined
}

const saysAlready = (line: string, quiet: string) =>
  lower(quiet).startsWith(lower(line)) || lower(line).startsWith(lower(quiet))

export const lower = (text: string) => `${text.slice(0, 1).toLowerCase()}${text.slice(1)}`
