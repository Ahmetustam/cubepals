// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * What a failed request says, through the pages' own tRPC client: the API's refusals in its words,
 * and no answer at all, or an answer from in between, never blamed on a connection that is up.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { refusing } from '@blockly/control/testing/refusing'
import { messageOf, unanswered } from './api.tsx'
import { failedWith } from './failed-call.ts'

const online = Object.getOwnPropertyDescriptor(globalThis.navigator, 'onLine')
afterEach(() => {
  if (online) Object.defineProperty(globalThis.navigator, 'onLine', online)
  else Reflect.deleteProperty(globalThis.navigator, 'onLine')
})
const goOffline = () =>
  Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true })

describe('what a failed request says', () => {
  test('a refusal from the API, in its own words, and never asked again', async () => {
    const refused = await failedWith(refusing('slug_taken', 'That address is taken — try adding a word.'))
    expect(messageOf(refused)).toBe('That address is taken — try adding a word.')
    expect(unanswered(refused)).toBe(false)
  })

  test('no answer at all is never the browser’s own words for it, nor blamed on a connection that is up', async () => {
    for (const said of [
      'Failed to fetch',
      'Load failed',
      'NetworkError when attempting to fetch resource.',
    ]) {
      const error = await failedWith(() => Promise.reject(new TypeError(said)))
      expect(unanswered(error)).toBe(true)
      expect(messageOf(error)).toBe('Cubepals couldn’t be reached. Try again in a moment.')
    }
  })

  test('a browser that knows it is offline is told so', async () => {
    goOffline()
    const error = await failedWith(() => Promise.reject(new TypeError('Failed to fetch')))
    expect(messageOf(error)).toBe('You’re offline. Check your connection and try again.')
  })

  test('a page from in between, as Cloudflare answers while the control plane restarts, is Cubepals’ side', async () => {
    // What staging answered on 2026-10-11 while its API restarted after running out of memory.
    const page = '<!DOCTYPE html>\n<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->'
    const error = await failedWith(async () => new Response(page, { status: 502 }))
    expect(unanswered(error)).toBe(true)
    expect(messageOf(error)).toBe('Something on Cubepals’ side didn’t answer. Try again in a moment.')
  })

  test('JSON that isn’t the API’s, as the control plane’s last-resort 500 is, is Cubepals’ side too', async () => {
    const error = await failedWith(async () =>
      Response.json({ error: 'Something went wrong on our side. Try again in a moment.' }, { status: 500 }),
    )
    expect(unanswered(error)).toBe(true)
    expect(messageOf(error)).toBe('Something on Cubepals’ side didn’t answer. Try again in a moment.')
  })
})
