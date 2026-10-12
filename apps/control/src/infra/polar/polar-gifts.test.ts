// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test'
import { giftOf } from './polar-gifts.ts'

const PLANS = new Set(['plus'])

/** The gift product as the sandbox holds it (read 2026-10-12), with the fields `giftOf` reads. */
const product = (patch: Record<string, unknown> = {}) => ({
  id: '3fef3123-591e-4723-95e7-b19e4157f6cc',
  is_recurring: false,
  is_archived: false,
  metadata: { purpose: 'gift', plan: 'plus', months: 1 },
  prices: [
    { amount_type: 'fixed', type: 'one_time', is_archived: false, price_amount: 1500, price_currency: 'usd' },
  ],
  ...patch,
})

test('a one-time product marked as a gift for a plan sold here is a gift', () => {
  expect(giftOf(product(), PLANS)).toEqual({
    id: '3fef3123-591e-4723-95e7-b19e4157f6cc',
    planKey: 'plus',
    months: 1,
    priceCents: 1500,
  })
  expect(giftOf(product({ metadata: { purpose: 'gift', plan: 'plus', months: '12' } }), PLANS)?.months).toBe(
    12,
  )
})

test('anything else is not one', () => {
  expect(giftOf(product({ is_recurring: true }), PLANS)).toBeNull()
  expect(giftOf(product({ metadata: { purpose: 'balance' } }), PLANS)).toBeNull()
  expect(giftOf(product({ metadata: { purpose: 'gift', plan: 'pro', months: 1 } }), PLANS)).toBeNull()
  expect(giftOf(product({ metadata: { purpose: 'gift', plan: 'plus', months: 0.5 } }), PLANS)).toBeNull()
  expect(giftOf(product({ prices: [{ amount_type: 'custom' }] }), PLANS)).toBeNull()
  expect(giftOf({ id: 'x' }, PLANS)).toBeNull()
})
