// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: LicenseRef-Cubepals-Reserved

/**
 * What the sleep demonstration's week of play comes to against a plan's hours, in the words under
 * its tally: inside them, or past them and what happens then. The week's arithmetic is
 * SleepDemo.tsx's; the plan's hours, a day's or a month's, are the pricing page's.
 */
import type { PublicPlan } from '@blockly/contracts'

/**
 * A plan whose largest server holds this many players can run a large one, and a large server
 * counts two of the plan's hours for each hour it runs, the largest four, past LARGEST_FROM_PLAYERS
 * (apps/control/src/domain/server/size.ts,
 * apps/control/src/domain/account/meter.ts). The words for it are the pricing page's
 * (apps/web/src/app/(public)/pricing/page.tsx).
 */
const LARGE_FROM_PLAYERS = 20
const LARGEST_FROM_PLAYERS = 50

/** What a week comes to against the plan's own hours (`usedBy`, SleepDemo.tsx), in words. */
export function usedSaid(used: number, plan: PublicPlan, plans: readonly PublicPlan[]): string {
  const included = plan.includedHours
  const daily = plan.per === 'day'
  const hours = `${included} hours${daily ? ' a day' : ''} on ${plan.name}`
  const until = plan.totalHours === null ? '' : `, until its ${plan.totalHours} in all are played`
  if (used === 0) return `Nothing ran, so none of the ${hours} were used.`
  if (used > included) {
    // A plan that would hold it, said the way the account page says it: past a day's hours, the
    // paid one; past a month's, a bigger month. Only a paid plan allows extra hours (mayBuyMore,
    // entitlements.ts), as the pricing page says.
    const roomier = plans.find((each) =>
      daily ? each.monthlyPriceCents > 0 : each.includedHours > included && each.includedHours >= used,
    )
    const extra = plan.monthlyPriceCents > 0 ? ', unless you allow extra hours, up to a limit you set' : ''
    return `More than the ${hours}. When they run out, the server sleeps until ${daily ? 'midnight where you are' : 'the 1st'}, when the hours start again${until}${extra}.${roomier ? ` ${roomier.name} has ${roomier.includedHours} hours a month.` : ''}`
  }
  // The week counts an hour awake as one of the plan's hours. On a plan that runs large servers
  // that isn't the whole of it, and the note says so.
  const large = plan.maxPlayers >= LARGE_FROM_PLAYERS
  return `Inside the ${hours}${plan.totalHours === null && daily ? ', every day' : until}.${
    large
      ? ` A large server, for big modpacks and groups of ${LARGE_FROM_PLAYERS} or more, counts two hours for each hour it runs${plan.maxPlayers > LARGEST_FROM_PLAYERS ? `, and the largest, for groups of more than ${LARGEST_FROM_PLAYERS}, four` : ''}.`
      : ''
  }`
}
