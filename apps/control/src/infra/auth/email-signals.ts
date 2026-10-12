// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * What an email address says about the person behind it, from lists others keep: the inbox it
 * reaches, with the aliases a provider lets one inbox have folded together (validator's
 * normalizeEmail: Gmail's dots and `+tags`, googlemail.com, and the `+tags` and `-tags` of
 * Outlook, iCloud and Yahoo), and whether it is a throwaway one (disposable-email-domains, kept by
 * the community and released by the package every month).
 */
import { disposableEmailBlocklistSet } from 'disposable-email-domains-js'
import validator from 'validator'

const DISPOSABLE = disposableEmailBlocklistSet()

/** The inbox an address reaches, written one way for all of its aliases. */
export function emailKey(email: string): string {
  const address = email.trim().toLowerCase()
  const normal = validator.normalizeEmail(address)
  return normal === false ? address : normal
}

/** Whether the address is at a throwaway-mail domain, or at a name under one. */
export function disposable(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@').at(-1) ?? ''
  const labels = domain.split('.')
  for (let i = 0; i < labels.length - 1; i++) if (DISPOSABLE.has(labels.slice(i).join('.'))) return true
  return false
}
