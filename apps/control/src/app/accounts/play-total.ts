// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The play a plan includes in all, once (`Entitlements.totalUnits`, Free's 20 hours): what the
 * owner's servers ran on that plan, in meter units, and what is left. Only runs started on the
 * plan count, so play on Plus spends none of it and coming back to Free starts no new block. Runs
 * from before runs kept their plan count toward nothing, which is how every account began with
 * all 20. The free play of accounts that share this one's (`free-play.ts`) counts as its own, as it
 * does for the day. Test accounts are held to the day only, as before. Stopping a run when it is
 * used is the session check's; the day's play beside it is `play-today.ts`'s.
 */
import type { ServerView } from '@blockly/contracts'
import type { Queryable } from '@blockly/db'
import type { Entitlements } from '../../domain/account/entitlements.ts'
import { METER_UNITS } from '../../domain/account/meter.ts'
import type { AccountStanding } from '../../domain/account/standing.ts'
import type { MemoryTier } from '../../domain/server/size.ts'
import { freeSharers } from './free-play.ts'
import { runUnitsSince } from './persistence.ts'

export interface PlayTotal {
  /** The plan's block in all, in units. */
  included: number
  /** Played on the plan, open runs counted up to now. */
  units: number
  /** Units left; zero once they are used, and they don't come back. */
  left: number
}

/** The account's play in all; null when its plan has no such block, or it is a test account. */
export async function playTotal(
  q: Queryable,
  standing: Pick<AccountStanding, 'userId' | 'plan' | 'testAccount'>,
  plan: Pick<Entitlements, 'totalUnits'>,
  now: Date,
): Promise<PlayTotal | null> {
  if (plan.totalUnits === null || standing.testAccount) return null
  const { ids } = await freeSharers(q, standing.userId, now)
  const units = await runUnitsSince(q, ids, new Date(0), now, standing.plan)
  return { included: plan.totalUnits, units, left: Math.max(0, plan.totalUnits - units) }
}

/** Units left of the account's play in all, for the policy; null as `playTotal`'s. */
export async function playTotalLeft(
  q: Queryable,
  standing: Pick<AccountStanding, 'userId' | 'plan' | 'testAccount'>,
  plan: Pick<Entitlements, 'totalUnits'>,
  now: Date,
): Promise<number | null> {
  const total = await playTotal(q, standing, plan, now)
  return total === null ? null : total.left
}

/** The play in all as the server page reads it: hours on this server's size, which may count double. */
export const totalView = (total: PlayTotal | null, tier: MemoryTier): ServerView['playTotal'] =>
  total === null
    ? null
    : { hours: total.included, hoursLeft: Math.floor((total.left / METER_UNITS[tier]) * 100) / 100 }
