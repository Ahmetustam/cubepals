// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/** The facts that tell one person's accounts apart: a network address, and a player ID. */
import { describe, expect, test } from 'bun:test'
import { addressKey, paidForPlayer } from './free-play.ts'

describe('a network address, as a weak signal counts it', () => {
  test('IPv4 is itself, and an IPv6 address that only wraps one is that one', () => {
    expect(addressKey('203.0.113.9')).toBe('203.0.113.9')
    expect(addressKey(' 203.0.113.9 ')).toBe('203.0.113.9')
    expect(addressKey('::ffff:203.0.113.9')).toBe('203.0.113.9')
  })

  test('IPv6 counts by its /64, however it is written', () => {
    const key = '2001:db8:0:1::/64'
    for (const address of [
      '2001:db8:0:1::1',
      '2001:0db8:0000:0001:ffff:ffff:ffff:ffff',
      '2001:DB8:0:1:a::b',
      '2001:db8:0:1::5%eth0',
    ])
      expect(addressKey(address)).toBe(key)
    expect(addressKey('2001:db8:0:2::1')).toBe('2001:db8:0:2::/64')
    expect(addressKey('::1')).toBe('0:0:0:0::/64')
  })

  test('anything that isn’t an address is nobody’s', () => {
    for (const text of ['', 'localhost', '256.1.1.1', '1.2.3', '2001:db8::1::2', 'g::1', '1:2:3:4:5:6:7:8:9'])
      expect(addressKey(text)).toBeNull()
  })
})

describe('players', () => {
  test('only a Minecraft account’s ID counts; offline-mode IDs are made from names', () => {
    expect(paidForPlayer('069a79f4-44e9-4726-a5be-fca90e38aaf5')).toBe(true)
    expect(paidForPlayer('5627dd98-e6be-3c21-b8a8-e92344183641')).toBe(false)
  })
})
