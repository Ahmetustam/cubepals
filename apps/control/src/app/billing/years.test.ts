// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * A year of Plus paid at once, through the real Polar adapter against a stand-in for Polar's API:
 * the plan it gives and for how long, a renewal that follows the year before, a refund that
 * brings the end back, a month that stops renewing when a year follows it, the emails before the
 * last year ends, and its end by the clock in the audit log.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { TERMS_VERSION } from '@blockly/contracts'
import { DAY_MS, MINUTE_MS } from '@blockly/contracts/durations'
import { schema } from '@blockly/db'
import { eq } from 'drizzle-orm'
import { hasDatabase } from '../../testing/harness.ts'
import { orderEvent } from '../../testing/polar.ts'
import { PolarWorld, YEAR } from '../../testing/polar-world.ts'
import { loadStanding } from '../accounts/persistence.ts'
import type { UserActor } from '../actor.ts'
import { addMonths, monthsKept } from './years.ts'

describe('the months a year holds', () => {
  test('a month on is the same day, or the month’s last', () => {
    expect(addMonths(new Date('2027-01-31T09:00:00Z'), 1).toISOString()).toBe('2027-02-28T09:00:00.000Z')
    expect(addMonths(new Date('2028-01-31T09:00:00Z'), 1).toISOString()).toBe('2028-02-29T09:00:00.000Z')
    expect(addMonths(new Date('2026-10-12T15:30:00Z'), 12).toISOString()).toBe('2027-10-12T15:30:00.000Z')
  })

  test('a refund keeps the whole months still paid for, rounded down', () => {
    expect(monthsKept({ netCents: 15000, refundedCents: 0 })).toBe(12)
    // Seven months back, four months and some days in: the fifth is kept to its end.
    expect(monthsKept({ netCents: 15000, refundedCents: 7 * 1250 })).toBe(5)
    // Within the 14 days, past the full refund: all but part of the first month comes back.
    expect(monthsKept({ netCents: 15000, refundedCents: 15000 - 750 })).toBe(0)
    expect(monthsKept({ netCents: 15000, refundedCents: 15000 })).toBe(0)
    // A code that made it free keeps it whole.
    expect(monthsKept({ netCents: 0, refundedCents: 0 })).toBe(12)
    expect(monthsKept({ netCents: 12000, refundedCents: 1000 })).toBe(11)
  })
})

const w = new PolarWorld()

beforeAll(async () => {
  if (hasDatabase) await w.start()
}, 30_000)

afterAll(async () => {
  if (hasDatabase) await w.close()
})

beforeEach(() => w.reset())

const consent = { terms: TERMS_VERSION, startNow: true as const }

const yearsOf = (owner: UserActor) =>
  w.h.db.select().from(schema.planYears).where(eq(schema.planYears.userId, owner.userId))

/** A year paid now, and the order that paid it. */
const paidNow = async (owner: UserActor, at = new Date()) => {
  const id = await w.paidYear(owner, { created_at: at.toISOString() })
  return { id, at }
}

test.skipIf(!hasDatabase)(
  'a year paid at once is Plus for twelve months, and nothing renews it',
  async () => {
    const owner = await w.h.user('Ines')
    const { at } = await paidNow(owner)
    const ends = addMonths(at, 12)
    expect((await loadStanding(w.h.db, owner.userId)).plan).toBe('plus')
    const overview = await w.h.app.accountQueries.overview(owner)
    expect(overview.plan.billed).toBeNull()
    expect(overview.plan.year).toEqual({ planKey: 'plus', startsAt: at, endsAt: ends, renewed: false })
    // Hours still come by the month, as Plus's do.
    expect(overview.entitlements.includedUnits).toBe(120)
    // Nothing renews to bill extra hours on.
    expect(overview.usage.extra.may).toBe(false)
    expect(await w.audited(owner, 'billing.year_bought')).toEqual([
      expect.objectContaining({ plan: 'plus', startsAt: at.toISOString(), endsAt: ends.toISOString() }),
    ])
    expect(await w.audited(owner, 'account.plan_changed')).toEqual([
      expect.objectContaining({ from: 'free', to: 'plus' }),
    ])
    // The order is Plus's revenue, as a month's is.
    expect((await w.kept((await yearsOf(owner))[0]?.externalOrderId ?? ''))?.planKey).toBe('plus')
    expect((await loadStanding(w.h.db, owner.userId, new Date(ends.getTime() - MINUTE_MS))).plan).toBe('plus')
    expect((await loadStanding(w.h.db, owner.userId, new Date(ends.getTime() + MINUTE_MS))).plan).toBe('free')
  },
)

test.skipIf(!hasDatabase)('the order delivered again makes no second year', async () => {
  const owner = await w.h.user('Jo')
  const { id } = await paidNow(owner)
  const held = w.orders.get(id)
  await w.post(orderEvent(held as NonNullable<typeof held>, 'order.updated'))
  expect(await yearsOf(owner)).toHaveLength(1)
  expect(await w.audited(owner, 'billing.year_bought')).toHaveLength(1)
})

test.skipIf(!hasDatabase)(
  'a checkout for a year is the yearly product, and a renewal follows the year before',
  async () => {
    const owner = await w.h.user('Kofi')
    const { url } = await w.h.app.billing.startCheckout(owner, 'plus', { term: 'year', consent })
    expect(url).toStartWith('https://polar.test/checkout/')
    expect([...w.checkouts.values()].at(-1)?.asked.products).toEqual([YEAR])
    expect(await w.audited(owner, 'billing.checkout_started')).toEqual([
      expect.objectContaining({ plan: 'plus', term: 'year' }),
    ])

    const { at } = await paidNow(owner)
    // On Plus already, a year can still be bought: it is how a year is renewed.
    await w.h.app.billing.startCheckout(owner, 'plus', { term: 'year', consent })
    await paidNow(owner, new Date(at.getTime() + DAY_MS))
    const [first, second] = (await yearsOf(owner)).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    expect(second?.startsAt).toEqual(first?.endsAt as Date)
    expect(second?.endsAt).toEqual(addMonths(first?.endsAt as Date, 12))
    const year = (await w.h.app.accountQueries.overview(owner)).plan.year
    expect(year).toMatchObject({ startsAt: at, endsAt: second?.endsAt, renewed: true })
    // A year paid ahead isn't bought twice by mistake.
    await expect(w.h.app.billing.startCheckout(owner, 'plus', { term: 'year', consent })).rejects.toThrow(
      /next year of Plus is paid for already/,
    )
    // Nor is Plus by the month, on top of a year.
    await expect(w.h.app.billing.startCheckout(owner, 'plus', { consent })).rejects.toThrow(/already/)
  },
)

test.skipIf(!hasDatabase)(
  'a refund brings the end back to the whole months left, and a full one ends it',
  async () => {
    const owner = await w.h.user('Lena')
    const { id, at } = await paidNow(owner)
    const held = w.orders.get(id) as NonNullable<ReturnType<typeof w.orders.get>>
    await w.post(
      orderEvent({ ...held, status: 'partially_refunded', refunded_amount: 7 * 1250 }, 'order.refunded'),
    )
    expect((await yearsOf(owner))[0]?.endsAt).toEqual(addMonths(at, 5))
    expect(await w.audited(owner, 'billing.year_shortened')).toEqual([
      expect.objectContaining({ endsAt: addMonths(at, 5).toISOString() }),
    ])
    expect((await loadStanding(w.h.db, owner.userId)).plan).toBe('plus')

    await w.post(orderEvent({ ...held, status: 'refunded', refunded_amount: 15000 }, 'order.refunded'))
    expect((await loadStanding(w.h.db, owner.userId)).plan).toBe('free')
    expect((await w.h.app.accountQueries.overview(owner)).plan.year).toBeNull()
    expect(await w.audited(owner, 'account.plan_changed')).toEqual([
      expect.objectContaining({ from: 'free', to: 'plus' }),
      expect.objectContaining({ from: 'plus', to: 'free' }),
    ])
  },
)

test.skipIf(!hasDatabase)(
  'bought while a month renews, the year follows it and the month stops renewing',
  async () => {
    const owner = await w.h.user('Mo')
    const sub = randomUUID()
    const monthEnds = new Date(Date.now() + 20 * DAY_MS)
    await w.standing(owner, sub, { current_period_end: monthEnds.toISOString() })
    await w.ordered(owner, sub, { created_at: new Date().toISOString() })
    const before = w.polar.requests.length
    await paidNow(owner)
    const [year] = await yearsOf(owner)
    expect(year?.startsAt).toEqual(monthEnds)
    expect(year?.endsAt).toEqual(addMonths(monthEnds, 12))
    const asked = w.polar.requests.slice(before).find((r) => r.method === 'PATCH')
    expect(asked?.path).toBe(`/v1/subscriptions/${sub}`)
    expect(JSON.parse(asked?.body ?? '{}')).toEqual({ cancel_at_period_end: true })
    expect((await w.h.app.accountQueries.overview(owner)).plan.year).toMatchObject({ startsAt: monthEnds })
  },
)

test.skipIf(!hasDatabase)('owners hear 14 and 3 days before the last year ends, once each', async () => {
  const owner = await w.h.user('Noor')
  const { at } = await paidNow(owner)
  const ends = addMonths(at, 12)
  const daysBefore = (days: number) => new Date(ends.getTime() - days * DAY_MS)
  const { billing } = w.h.app
  const subjects = async () => (await w.mailTo(owner)).map((m) => m.subject)
  await billing.remindYears(daysBefore(20))
  expect(await subjects()).toEqual([])
  await billing.remindYears(daysBefore(13))
  await billing.remindYears(daysBefore(12))
  expect(await subjects()).toEqual(['Your year of Cubepals Plus ends in 14 days'])
  await billing.remindYears(daysBefore(2))
  await billing.remindYears(daysBefore(1))
  expect(await subjects()).toEqual([
    'Your year of Cubepals Plus ends in 14 days',
    'Your year of Cubepals Plus ends in 3 days',
  ])
  const [told] = await w.mailTo(owner)
  expect(told?.text).toContain('It doesn’t renew on its own, so nothing will be charged.')
  expect(told?.text).toContain('another year is $250.00')

  // A year renewed is not the last, and isn't reminded about.
  const renewed = await w.h.user('Omar')
  const first = await paidNow(renewed)
  await paidNow(renewed)
  await billing.remindYears(new Date(addMonths(first.at, 12).getTime() - 10 * DAY_MS))
  expect(await w.mailTo(renewed)).toEqual([])
})

test.skipIf(!hasDatabase)('a year’s end by the clock is audited once, with the plan it left', async () => {
  const owner = await w.h.user('Pia')
  const { at } = await paidNow(owner)
  const after = new Date(addMonths(at, 12).getTime() + MINUTE_MS)
  expect(await w.h.app.billing.recordLapses(after)).toBeGreaterThanOrEqual(1)
  expect(await w.audited(owner, 'billing.year_ended')).toHaveLength(1)
  expect(await w.audited(owner, 'account.plan_changed')).toEqual([
    expect.objectContaining({ from: 'free', to: 'plus' }),
    expect.objectContaining({ from: 'plus', to: 'free' }),
  ])
  await w.h.app.billing.recordLapses(after)
  expect(await w.audited(owner, 'billing.year_ended')).toHaveLength(1)
})
