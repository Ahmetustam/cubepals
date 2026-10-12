// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The deployment's free-link tuning and abuse limits (`domain/account/tuning.ts`), installed once
 * at startup from private configuration and read wherever they are needed. Until installed, as in
 * tests, the defaults apply.
 */
import {
  type AbuseLimits,
  DEFAULT_ABUSE_LIMITS,
  DEFAULT_FREE_LINK_TUNING,
  type FreeLinkTuning,
} from '../domain/account/tuning.ts'

let installed: { freeLinks: FreeLinkTuning; abuse: AbuseLimits } = {
  freeLinks: DEFAULT_FREE_LINK_TUNING,
  abuse: DEFAULT_ABUSE_LIMITS,
}

/** The tuning in force. */
export const tuning = (): { freeLinks: FreeLinkTuning; abuse: AbuseLimits } => installed

/** Puts a deployment's own tuning in force; the composition root's, once, at startup. */
export function installTuning(values: { freeLinks: FreeLinkTuning; abuse: AbuseLimits }): void {
  installed = values
}
