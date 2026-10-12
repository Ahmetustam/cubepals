// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Gifts: time on a paid plan that one account buys and another redeems with a code. Only the
 * code's hash is kept; the code itself goes once, by email, to whoever bought it.
 */
import { index, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth.ts'
import { createdAt, ts } from './columns.ts'

export const planGifts = pgTable(
  'plan_gifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** The order that paid for it, as `billing_orders` keeps it: one gift per order. */
    provider: text('provider').notNull(),
    externalOrderId: text('external_order_id').notNull(),
    buyerId: text('buyer_id')
      .notNull()
      .references(() => users.id),
    /** What it gives: `plan`, time on `planKey` for `months`. Other kinds (credit) come later. */
    kind: text('kind').notNull().default('plan'),
    planKey: text('plan_key'),
    months: integer('months'),
    /** SHA-256 of the code as it is typed, normalised; null until the code is made. */
    codeHash: text('code_hash'),
    /** The code's last four characters, so the buyer can tell their codes apart. */
    codeHint: text('code_hint'),
    /** When the code was last emailed to the buyer; a code not yet emailed is made again. */
    emailedAt: ts('emailed_at'),
    redeemedBy: text('redeemed_by').references(() => users.id),
    redeemedAt: ts('redeemed_at'),
    /** The time it gives the account that redeemed it: from `startsAt` (now, or when what it already had ends) to `endsAt`. */
    startsAt: ts('starts_at'),
    endsAt: ts('ends_at'),
    /** Refunded: an unredeemed code stops working, and redeemed time ends then. */
    voidedAt: ts('voided_at'),
    /** When its end was recorded, with the plan change it made. */
    endRecordedAt: ts('end_recorded_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('plan_gifts_order').on(t.provider, t.externalOrderId),
    uniqueIndex('plan_gifts_code').on(t.codeHash),
    index('plan_gifts_buyer').on(t.buyerId, t.createdAt),
    index('plan_gifts_redeemed_by').on(t.redeemedBy),
  ],
)
