// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/** The chip-in offer on a server's page and invitation, as a friend reads it. */
import { describe, expect, test } from 'bun:test'
import type { PublicServerView } from '@blockly/contracts'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ApiProvider } from '../../lib/api'
import { ViewerProvider } from '../../lib/viewer'
import { ChipIn } from './chip-in'

/** An invitation to a server, as a friend reads it. */
const invite = (chipIn: PublicServerView['chipIn']) =>
  ({ name: 'Sunset Valley', chipIn }) as unknown as PublicServerView

const offer = (view: PublicServerView, signedIn: boolean) =>
  renderToStaticMarkup(
    createElement(
      ApiProvider,
      null,
      createElement(ViewerProvider, {
        signedIn,
        // biome-ignore lint/correctness/noChildrenProp: with no JSX in a test, its props are where the provider's children are typed
        children: createElement(ChipIn, { view, to: { code: 'abc' } }),
      }),
    ),
  )

describe('chipping in from an invitation', () => {
  test('offers each amount in real hours on the server, and sends someone signed out to sign in first', () => {
    const page = offer(invite({ hoursPerDollar: 4 }), false)
    expect(page).toContain('Help keep Sunset Valley running.')
    expect(page).toContain('$5 · 20 hours')
    expect(page).toContain('$20 · 80 hours')
    expect(page).toContain(`href="/sign-in?next=${encodeURIComponent('/join/abc')}"`)
    // A large server runs half as long on the same money.
    expect(offer(invite({ hoursPerDollar: 2 }), true)).toContain('$10 · 20 hours')
  })

  test('says nothing where the server takes no chip-ins', () => {
    expect(offer(invite(null), true)).toBe('')
  })
})
