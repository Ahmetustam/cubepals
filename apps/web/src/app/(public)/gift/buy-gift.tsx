// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

'use client'

/**
 * Buying a gift: the gifts on sale, the Terms to agree to, and on to Polar's payment page; back
 * from it, word that the code is on its way. Signed out, buying makes the account first. Signed
 * in, the gifts the person bought, with a new code for one whose email went missing.
 */

import { type GiftOptionView, type GiftView, TERMS_VERSION } from '@blockly/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { messageOf, useTRPC } from '../../../lib/api'
import { behindSignIn, behindSignUp, useSignedIn } from '../../../lib/viewer'
import { Button, Card, Checkbox, LoadFailed, Note, Skeleton } from '../../../ui'

export function BuyGift() {
  return (
    <Suspense fallback={<Skeleton width={240} height={36} />}>
      <Gifts />
    </Suspense>
  )
}

function Gifts() {
  const trpc = useTRPC()
  const signedIn = useSignedIn()
  const bought = useSearchParams().get('bought') === '1'
  const options = useQuery(trpc.gifts.options.queryOptions())
  if (options.isPending) return <Skeleton width={240} height={36} />
  if (options.isError)
    return <LoadFailed error={messageOf(options.error)} onRetry={() => options.refetch()} />
  return (
    <>
      {bought && <Note tone="success">Thank you. Your code is on its way to your email.</Note>}
      {options.data.length === 0 ? (
        <Note tone="info">Gifts aren’t on sale here.</Note>
      ) : (
        <Offer options={options.data} signedIn={signedIn} />
      )}
      {signedIn && <Bought />}
    </>
  )
}

function Offer({ options, signedIn }: { options: GiftOptionView[]; signedIn: boolean }) {
  const trpc = useTRPC()
  const buy = useMutation(
    trpc.gifts.buy.mutationOptions({ onSuccess: ({ url }) => window.location.assign(url) }),
  )
  const [chosen, setChosen] = useState(options[0]?.id ?? '')
  const [terms, setTerms] = useState(false)
  const [unticked, setUnticked] = useState(false)
  const pay = () => {
    if (!terms) {
      setUnticked(true)
      return
    }
    buy.mutate({ option: chosen, consent: { terms: TERMS_VERSION } })
  }
  return (
    <div className="bk-stack" style={{ gap: 'var(--space-16)' }}>
      {options.map((option) => (
        <Card
          key={option.id}
          flat
          title={`${giftSaid(option)}: ${dollars(option.priceCents)}`}
          description="VAT included where it applies. Paid once."
          footer={
            options.length > 1 && (
              <Button
                variant={chosen === option.id ? 'primary' : 'outline'}
                onClick={() => setChosen(option.id)}
              >
                {chosen === option.id ? 'Chosen' : 'Choose'}
              </Button>
            )
          }
        />
      ))}
      {signedIn ? (
        <>
          <Checkbox
            checked={terms}
            onChange={setTerms}
            invalid={unticked && !terms}
            error={unticked && !terms ? 'Tick the box to continue to payment.' : null}
          >
            I agree to the{' '}
            <Link href="/legal/terms" target="_blank">
              Terms of Service
            </Link>{' '}
            and the{' '}
            <Link href="/legal/refunds#gifts" target="_blank">
              Refunds
            </Link>{' '}
            policy for gifts.
          </Checkbox>
          <p className="type-body-sm" style={{ color: 'var(--ink-muted)' }}>
            Polar, our merchant of record, takes the payment and shows the final price before you pay. Not
            given the code yet and changed your mind? You can have a full refund within 14 days.
          </p>
          <div className="bk-row bk-wrap" style={{ gap: 'var(--space-8)' }}>
            <Button variant="primary" size="lg" disabled={buy.isPending} onClick={pay}>
              {buy.isPending ? 'Opening the payment page…' : 'Continue to payment'}
            </Button>
          </div>
          {buy.isError && <Note tone="danger">{messageOf(buy.error)}</Note>}
        </>
      ) : (
        <div className="bk-row bk-wrap" style={{ gap: 'var(--space-8)' }}>
          <Button variant="primary" size="lg" href={behindSignUp(false, '/gift')}>
            Make an account to buy it
          </Button>
          <Button variant="ghost" size="lg" href={behindSignIn(false, '/gift')}>
            Sign in
          </Button>
        </div>
      )}
    </div>
  )
}

/** The gifts the person bought, newest first; none, and nothing is shown. */
function Bought() {
  const trpc = useTRPC()
  const queries = useQueryClient()
  const mine = useQuery(trpc.gifts.mine.queryOptions())
  const resend = useMutation(
    trpc.gifts.resend.mutationOptions({
      onSuccess: () => queries.invalidateQueries(trpc.gifts.mine.queryFilter()),
    }),
  )
  if (!mine.data || mine.data.length === 0) return null
  return (
    <section className="bk-stack" style={{ gap: 'var(--space-12)' }}>
      <h2 className="type-heading" style={{ color: 'var(--ink)' }}>
        Gifts you bought
      </h2>
      {mine.data.map((gift) => (
        <Card
          key={gift.id}
          flat
          title={
            gift.planKey && gift.months ? giftSaid({ planKey: gift.planKey, months: gift.months }) : 'A gift'
          }
          description={stateSaid(gift)}
          footer={
            gift.state === 'waiting' &&
            gift.codeHint !== null && (
              <Button
                variant="outline"
                disabled={resend.isPending}
                onClick={() => resend.mutate({ giftId: gift.id })}
              >
                Email me a new code
              </Button>
            )
          }
        />
      ))}
      <p className="type-body-sm" style={{ color: 'var(--ink-muted)' }}>
        A new code replaces the old one, which stops working.
      </p>
      {resend.isSuccess && <Note tone="success">A new code is on its way to your email.</Note>}
      {resend.isError && <Note tone="danger">{messageOf(resend.error)}</Note>}
    </section>
  )
}

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

function stateSaid(gift: GiftView): string {
  const bought = `Bought ${DAY.format(new Date(gift.boughtAt))}`
  if (gift.state === 'refunded') return `${bought}. Refunded, so its code no longer works.`
  if (gift.state === 'redeemed')
    return `${bought}. Redeemed ${gift.redeemedAt ? DAY.format(new Date(gift.redeemedAt)) : ''}.`
  if (gift.codeHint === null) return `${bought}. Its code is on its way.`
  return `${bought}. Not redeemed yet. Its code ends in ${gift.codeHint}.`
}

/** "A month of Plus", "12 months of Plus". */
const giftSaid = (gift: { planKey: string; months: number }) =>
  `${gift.months === 1 ? 'A month' : `${gift.months} months`} of ${gift.planKey[0]?.toUpperCase() ?? ''}${gift.planKey.slice(1)}`

/** A price as it is said: "$15", or "$4.50" where there are cents. */
const dollars = (cents: number) => `$${cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2)}`
