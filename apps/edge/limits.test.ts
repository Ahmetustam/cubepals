// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/** The gate: what it lets through per server and per address, and what it forgets. */

import { expect, test } from 'bun:test'
import { SECOND_MS } from '../../packages/contracts/src/durations.ts'
import { addressKey, Gate, type Limits } from './limits.ts'

const LIMITS: Limits = {
  address: { connections: { perSecond: 1, burst: 3 }, greeting: 2 },
  server: { connections: { perSecond: 2, burst: 4 }, open: 5 },
}

function clock() {
  let now = 0
  return { now: () => now, pass: (ms: number) => (now += ms) }
}

test('a flood on one server is refused there, and another server still takes connections', () => {
  const gate = new Gate(LIMITS, clock().now)
  const flooded = Array.from({ length: 10 }, () => gate.admit('busy.play.test'))
  expect(flooded.filter(Boolean)).toHaveLength(4)
  expect(gate.admit('quiet.play.test')).not.toBeNull()
})

test('a server takes connections again as its rate refills', () => {
  const time = clock()
  const gate = new Gate(LIMITS, time.now)
  for (let i = 0; i < 4; i++) gate.admit('a.play.test')?.()
  expect(gate.admit('a.play.test')).toBeNull()
  time.pass(SECOND_MS / 2)
  expect(gate.admit('a.play.test')).not.toBeNull()
  expect(gate.admit('a.play.test')).toBeNull()
})

test('a server holds only so many connections open, and a closed one frees its place', () => {
  const time = clock()
  const gate = new Gate(
    { ...LIMITS, server: { connections: { perSecond: 100, burst: 100 }, open: 2 } },
    time.now,
  )
  const first = gate.admit('a.play.test')
  gate.admit('a.play.test')
  expect(gate.admit('a.play.test')).toBeNull()
  first?.()
  first?.()
  expect(gate.admit('a.play.test')).not.toBeNull()
  expect(gate.admit('a.play.test')).toBeNull()
})

test('an address may open only so many connections a second, and only so many still greeting', () => {
  const time = clock()
  const gate = new Gate(LIMITS, time.now)
  const greeting = [gate.greet('203.0.113.7'), gate.greet('203.0.113.7')]
  expect(gate.greet('203.0.113.7')).toBeNull()
  for (const done of greeting) done?.()
  expect(gate.greet('203.0.113.7')).not.toBeNull()
  expect(gate.greet('203.0.113.7')).toBeNull()
  expect(gate.greet('203.0.113.8')).not.toBeNull()
})

test('an IPv6 address counts by its /64, and an IPv4 one written as IPv6 as itself', () => {
  expect(addressKey('2001:db8:0:1::1')).toBe('2001:db8:0:1::/64')
  expect(addressKey('2001:0db8:0000:0001:ffff:0:0:2')).toBe('2001:db8:0:1::/64')
  expect(addressKey('::ffff:203.0.113.7')).toBe('203.0.113.7')
  expect(addressKey('203.0.113.7')).toBe('203.0.113.7')
})

test('a sweep says what was refused, once, and forgets what limits nothing', () => {
  const time = clock()
  const gate = new Gate(LIMITS, time.now)
  for (let i = 0; i < 6; i++) gate.admit('a.play.test')
  expect(gate.sweep()).toEqual(new Map([['server-rate a.play.test', 2]]))
  expect(gate.sweep()).toEqual(new Map())
})
