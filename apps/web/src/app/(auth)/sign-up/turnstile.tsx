// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

'use client'

/**
 * Cloudflare Turnstile's check that whoever signs up is a person, shown only when Cloudflare needs
 * them to do something (`interaction-only`): most people never see it. Its answer goes with the
 * sign-up as `x-captcha-response`, which the control plane checks. Each answer works once.
 */
import { useEffect, useRef } from 'react'

/** Turnstile's script, rendered by hand so the widget follows React's own mounting. */
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/** What Turnstile's script puts on `window` (developers.cloudflare.com/turnstile, client-side rendering). */
interface TurnstileApi {
  render(
    element: HTMLElement,
    options: {
      sitekey: string
      action: string
      appearance: 'interaction-only'
      size: 'flexible'
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    },
  ): string
  reset(widget: string): void
  remove(widget: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<TurnstileApi> | null = null

function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('no turnstile')))
    script.onerror = () => {
      loading = null
      reject(new Error('turnstile did not load'))
    }
    document.head.append(script)
  })
  return loading
}

/**
 * The check, for `siteKey`: `onToken` gets each answer, and null when one expires or fails.
 * `reset` changes to ask for a fresh answer after one was used.
 */
export function Turnstile({
  siteKey,
  onToken,
  reset,
}: {
  siteKey: string
  onToken: (token: string | null) => void
  reset: number
}) {
  const element = useRef<HTMLDivElement>(null)
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null)
  const told = useRef(onToken)
  told.current = onToken

  useEffect(() => {
    let gone = false
    loadTurnstile()
      .then((api) => {
        if (gone || element.current === null) return
        const id = api.render(element.current, {
          sitekey: siteKey,
          action: 'sign-up',
          appearance: 'interaction-only',
          size: 'flexible',
          callback: (token) => told.current(token),
          'expired-callback': () => told.current(null),
          'error-callback': () => told.current(null),
        })
        widget.current = { api, id }
      })
      .catch(() => told.current(null))
    return () => {
      gone = true
      if (widget.current) widget.current.api.remove(widget.current.id)
      widget.current = null
    }
  }, [siteKey])

  useEffect(() => {
    if (reset > 0 && widget.current) widget.current.api.reset(widget.current.id)
  }, [reset])

  return <div ref={element} />
}
