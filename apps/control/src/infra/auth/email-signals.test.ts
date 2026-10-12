// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/** An email's inbox, its aliases folded together, and throwaway domains, from the lists others keep. */
import { describe, expect, test } from 'bun:test'
import { disposable, emailKey } from './email-signals.ts'

describe('the inbox an address reaches', () => {
  test('Gmail’s dots, +tags and googlemail.com are one inbox, whatever the case', () => {
    for (const alias of [
      'steve@gmail.com',
      'S.t.e.v.e@gmail.com',
      'steve+cubepals@googlemail.com',
      ' Steve@GMAIL.com',
    ])
      expect(emailKey(alias)).toBe('steve@gmail.com')
  })

  test('the big providers’ +tags go, and the rest of an address stays as it is', () => {
    expect(emailKey('steve+one@outlook.com')).toBe('steve@outlook.com')
    expect(emailKey('steve+one@icloud.com')).toBe('steve@icloud.com')
    // Elsewhere a dot or a tag may be a different person's inbox.
    expect(emailKey('s.teve+one@example.test')).toBe('s.teve+one@example.test')
    expect(emailKey('Steve@Example.test')).toBe('steve@example.test')
  })
})

describe('throwaway addresses', () => {
  test('a domain on the list is one, and so is a name under it', () => {
    expect(disposable('someone@mailinator.com')).toBe(true)
    expect(disposable('someone@MAILINATOR.com')).toBe(true)
    expect(disposable('someone@inbox.mailinator.com')).toBe(true)
  })

  test('everyday providers are not', () => {
    for (const address of ['someone@gmail.com', 'someone@outlook.com', 'someone@example.test'])
      expect(disposable(address)).toBe(false)
  })
})
