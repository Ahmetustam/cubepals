// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Gift products in Polar's terms (SDK 2026-10 `models`, read 2026-10-12): a one-time product with
 * metadata `purpose: gift`, `plan` and `months`, at one fixed price, read back as a gift; anything
 * else is not one. The products are made in Polar, like the plans', so a new gift (a year of Plus)
 * is a product there and nothing here. Requests themselves are PolarBilling's.
 */
import type { models } from '@polar-sh/sdk/2026-10'
import { z } from 'zod'
import type { GiftProduct } from '../../app/ports/optional.ts'
import type { Fields } from './polar-models.ts'

/** The metadata that marks a product as a gift, and the products list is filtered on. */
export const GIFT_METADATA = { purpose: 'gift' } as const

const PolarGift = z.object({
  id: z.string(),
  is_recurring: z.boolean(),
  is_archived: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  prices: z.array(
    z.object({
      amount_type: z.string(),
      is_archived: z.boolean().nullish(),
      price_amount: z.number().int().nullish(),
      price_currency: z.string().nullish(),
    } satisfies Fields<models.ProductPrice>),
  ),
} satisfies Fields<models.Product>)

/**
 * A gift product for one of `plans`, or null: one that recurs, names no plan this deployment
 * sells, gives no whole number of months, or has no fixed price in dollars sells no gift here.
 */
export function giftOf(data: unknown, plans: ReadonlySet<string>): GiftProduct | null {
  const parsed = PolarGift.safeParse(data)
  if (!parsed.success) return null
  const product = parsed.data
  if (product.is_recurring || product.is_archived) return null
  if (product.metadata.purpose !== GIFT_METADATA.purpose) return null
  const planKey = product.metadata.plan
  const months = Number(product.metadata.months)
  if (typeof planKey !== 'string' || !plans.has(planKey)) return null
  if (!Number.isInteger(months) || months < 1) return null
  const price = product.prices.find(
    (p) => p.amount_type === 'fixed' && !p.is_archived && (p.price_currency ?? 'usd') === 'usd',
  )
  if (price?.price_amount == null) return null
  return { id: product.id, planKey, months, priceCents: price.price_amount }
}
