// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import { BuyGiftInput, GiftRef, RedeemGiftInput } from '@blockly/contracts'
import { authedProcedure, publicProcedure, router } from './trpc.ts'

/** Time on a plan bought for someone else (`Gifts`), under `gifts`. */
export const gifts = router({
  /** What the gift page offers, for anyone. */
  options: publicProcedure.query(({ ctx }) => ctx.services.billing.gifts.options()),
  buy: authedProcedure
    .input(BuyGiftInput)
    .mutation(({ ctx, input }) => ctx.services.billing.gifts.buy(ctx.actor, input.option, input.consent)),
  redeem: authedProcedure
    .input(RedeemGiftInput)
    .mutation(({ ctx, input }) => ctx.services.billing.gifts.redeem(ctx.actor, input.code)),
  /** The gifts the account bought. */
  mine: authedProcedure.query(({ ctx }) => ctx.services.billing.gifts.mine(ctx.actor)),
  /** A new code for an unredeemed gift, emailed to its buyer; the old one stops working. */
  resend: authedProcedure
    .input(GiftRef)
    .mutation(({ ctx, input }) => ctx.services.billing.gifts.resend(ctx.actor, input.giftId)),
})
