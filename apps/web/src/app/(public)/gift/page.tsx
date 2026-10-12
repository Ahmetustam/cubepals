// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { Metadata } from 'next'
import Link from 'next/link'
import { pageMetadata } from '../../../lib/site'
import { BuyGift } from './buy-gift'

export const metadata: Metadata = pageMetadata({
  title: 'Give Plus',
  description: 'Buy someone a month of Cubepals Plus. They get a code, and Plus starts when they use it.',
  path: '/gift',
})

/**
 * The gift page, for anyone: what a gift is, the gifts on sale, and, signed in, the ones the
 * person bought. Buying is `BuyGift`'s; how it works for whoever pays is `/paying-for-others`.
 */
export default function GiftPage() {
  return (
    <div className="bk-stack" style={{ gap: 'var(--space-24)', maxWidth: 'var(--width-form)' }}>
      <header className="bk-stack" style={{ gap: 'var(--space-8)' }}>
        <h1 className="type-display-md" style={{ color: 'var(--ink)' }}>
          Give Plus
        </h1>
        <p className="type-body" style={{ color: 'var(--ink-muted)' }}>
          We email you a code. Pass it on, and Plus starts on their account when they use it. It doesn’t
          renew, so there’s nothing for anyone to cancel.
        </p>
        <p className="type-body-sm" style={{ color: 'var(--ink-muted)' }}>
          Paying for a friend’s server or your group’s?{' '}
          <Link href="/paying-for-others">Here’s how it works</Link>. Got a code?{' '}
          <Link href="/redeem">Redeem it</Link>.
        </p>
      </header>
      <BuyGift />
    </div>
  )
}
