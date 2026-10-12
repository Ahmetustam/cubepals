// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Gifts: time on a paid plan that one person buys for someone else, who redeems it with a code.
 * What the gift page offers and sends, what the redeem page sends, and how a buyer sees what
 * they bought.
 */
import { z } from 'zod'

/** A gift the gift page offers: what it gives, and what it costs, in US cents, before any tax. */
export interface GiftOptionView {
  /** The provider's product that sells it. */
  id: string
  planKey: string
  months: number
  priceCents: number
}

export const BuyGiftInput = z.object({
  option: z.string().trim().min(1).max(100),
  /** The buyer agreed to the Terms, which say how a gift is refunded. */
  consent: z.object({ terms: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
})
export type BuyGiftInput = z.infer<typeof BuyGiftInput>

/** A code as someone types or pastes it: dashes, spaces and case don't matter. */
export const RedeemGiftInput = z.object({ code: z.string().trim().min(1).max(64) })

export const GiftRef = z.object({ giftId: z.uuid() })

/**
 * A gift as its buyer sees it: what it gives, the end of its code, and where it is. `waiting`:
 * paid, its code on its way or sent and not yet used. `refunded`: its code no longer works.
 */
export interface GiftView {
  id: string
  planKey: string | null
  months: number | null
  codeHint: string | null
  state: 'waiting' | 'redeemed' | 'refunded'
  boughtAt: string
  redeemedAt: string | null
}

/** What redeeming a code gave the account: the plan, from when, and until when. */
export interface RedeemedGiftView {
  planKey: string
  startsAt: string
  endsAt: string
}
