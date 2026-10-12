// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * What tells one person's accounts apart from another's, as facts: the network an address belongs
 * to (an IPv6 one by its /64, which one home or phone is given), and whether a player ID is a
 * Minecraft account's. How sure they make Blockly is `free-links.ts`'s; where the facts come from
 * is `app/accounts/free-play.ts`'s.
 */

/**
 * The network an address belongs to, one of the signals free accounts are linked by: an IPv4
 * address itself (and an IPv6 one that only wraps it), an IPv6 one by its first 64 bits. Null for
 * anything that isn't an address, and for none at all.
 */
export function addressKey(address: string | null | undefined): string | null {
  const text = (address ?? '').trim().toLowerCase()
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text)
  if (mapped?.[1] !== undefined) return ipv4(mapped[1])
  if (!text.includes(':')) return ipv4(text)
  const groups = ipv6Groups(text)
  return groups === null ? null : `${groups.slice(0, 4).join(':')}::/64`
}

function ipv4(text: string): string | null {
  const parts = text.split('.')
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255)) return null
  return parts.map(Number).join('.')
}

/** The eight groups of an IPv6 address, each without leading zeros; null if it isn't one. */
function ipv6Groups(text: string): string[] | null {
  const [address] = text.split('%')
  if (address === undefined || (address.match(/::/g) ?? []).length > 1) return null
  const [head = '', tail] = address.split('::')
  const left = head === '' ? [] : head.split(':')
  const right = tail === undefined || tail === '' ? [] : tail.split(':')
  const missing = 8 - left.length - right.length
  if (tail === undefined ? missing !== 0 : missing < 1) return null
  const groups = [...left, ...Array<string>(tail === undefined ? 0 : missing).fill('0'), ...right]
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null
  return groups.map((g) => Number.parseInt(g, 16).toString(16))
}

/**
 * Whether a player ID is a Minecraft account's: Mojang's are random (version 4), and an
 * offline-mode server makes its IDs from names (version 3). Only a Minecraft account's is a main
 * player (`free-links.ts`).
 */
export const paidForPlayer = (uuid: string): boolean => uuid.charAt(14) === '4'
