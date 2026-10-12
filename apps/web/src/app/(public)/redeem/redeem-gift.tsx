// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

'use client'

/**
 * The code, filled in from the gift email's link, and the one button that redeems it. Signed out,
 * the person signs in or makes an account first and comes back here with the code still filled
 * in. Redeemed, it says what they have and until when.
 */

import type { RedeemedGiftView } from '@blockly/contracts'
import { MINUTE_MS } from '@blockly/contracts/durations'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { type SubmitEvent, Suspense, useState } from 'react'
import { messageOf, useTRPC } from '../../../lib/api'
import { behindSignIn, behindSignUp, useSignedIn } from '../../../lib/viewer'
import { Button, Note, Skeleton, TextField } from '../../../ui'

export function RedeemGift() {
  return (
    <Suspense fallback={<Skeleton width={240} height={36} />}>
      <Redeem />
    </Suspense>
  )
}

function Redeem() {
  const trpc = useTRPC()
  const queries = useQueryClient()
  const signedIn = useSignedIn()
  const [code, setCode] = useState(useSearchParams().get('code') ?? '')
  const redeem = useMutation(
    trpc.gifts.redeem.mutationOptions({ onSuccess: () => queries.invalidateQueries() }),
  )
  if (redeem.data) return <Redeemed gift={redeem.data} />
  const back = `/redeem${code ? `?code=${encodeURIComponent(code)}` : ''}`
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (code.trim()) redeem.mutate({ code })
  }
  return (
    <form className="bk-stack" style={{ gap: 'var(--space-16)' }} onSubmit={submit}>
      <TextField
        label="Gift code"
        mono
        autoComplete="off"
        spellCheck={false}
        placeholder="XXXX-XXXX-XXXX-XXXX"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        error={redeem.isError ? messageOf(redeem.error) : undefined}
      />
      {signedIn ? (
        <div className="bk-row bk-wrap" style={{ gap: 'var(--space-8)' }}>
          <Button variant="primary" size="lg" type="submit" disabled={redeem.isPending || !code.trim()}>
            {redeem.isPending ? 'Redeeming…' : 'Redeem'}
          </Button>
        </div>
      ) : (
        <div className="bk-row bk-wrap" style={{ gap: 'var(--space-8)' }}>
          <Button variant="primary" size="lg" href={behindSignUp(false, back)}>
            Make an account to redeem it
          </Button>
          <Button variant="ghost" size="lg" href={behindSignIn(false, back)}>
            Sign in
          </Button>
        </div>
      )}
    </form>
  )
}

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

function Redeemed({ gift }: { gift: RedeemedGiftView }) {
  const name = `${gift.planKey[0]?.toUpperCase() ?? ''}${gift.planKey.slice(1)}`
  const later = new Date(gift.startsAt).getTime() > Date.now() + MINUTE_MS
  return (
    <div className="bk-stack" style={{ gap: 'var(--space-16)' }}>
      <Note tone="success">
        {later
          ? `It’s yours. It starts on ${DAY.format(new Date(gift.startsAt))}, when the ${name} you have now ends, and runs until ${DAY.format(new Date(gift.endsAt))}.`
          : `It’s yours. You have ${name} until ${DAY.format(new Date(gift.endsAt))}.`}
      </Note>
      <div className="bk-row bk-wrap" style={{ gap: 'var(--space-8)' }}>
        <Button variant="primary" size="lg" href="/servers">
          Go to your servers
        </Button>
      </div>
    </div>
  )
}
