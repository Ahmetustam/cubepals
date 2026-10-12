// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import { BILLING_TERMS, type BillingTerm, UPGRADE_REASONS, type UpgradeReason } from '@blockly/contracts'

/**
 * The way to a paid plan's payment page. Every "Get Plus" goes to /checkout first, which asks
 * for the agreement the law and the API both want before the plan starts, then opens the payment
 * page. These say the plan, why it was reached for, and where to come back to in its address.
 */
export interface CheckoutAsk {
  plan: string
  /** By the month, or a year paid at once; the month when the address says nothing. */
  term?: BillingTerm
  reason: UpgradeReason
  /** Where to land after paying: a path in the app. */
  next?: string
}

/** Only ever a path on this site: never `//host` or `/\host`. */
const local = (path: string | null | undefined): path is string =>
  typeof path === 'string' && /^\/(?![/\\])/.test(path)

/** The checkout page's address for an ask. */
export function checkoutHref({ plan, term, reason, next }: CheckoutAsk): string {
  const query = new URLSearchParams({ plan, reason })
  if (term === 'year') query.set('term', term)
  if (local(next)) query.set('next', next)
  return `/checkout?${query}`
}

/** The ask a checkout page's address holds, or null when it names no plan. */
export function checkoutOf(params: URLSearchParams): CheckoutAsk | null {
  const plan = params.get('plan')?.trim()
  if (!plan) return null
  const said = params.get('reason')
  const reason = UPGRADE_REASONS.find((known): known is UpgradeReason => known === said) ?? 'account'
  const asked = params.get('term')
  const term = BILLING_TERMS.find((known): known is BillingTerm => known === asked) ?? 'month'
  const next = params.get('next')
  return local(next) ? { plan, term, reason, next } : { plan, term, reason }
}
