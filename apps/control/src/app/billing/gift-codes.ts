// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Gift codes: made at random, read the way a person types them, and kept only as a hash. A code is
 * sixteen characters of Crockford's base 32 (80 bits), in four groups, with no letter that reads
 * as another: O is 0 and I or L is 1 when typed, and dashes, spaces and case don't matter.
 */
import { createHash, randomBytes } from 'node:crypto'

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const LENGTH = 16

/** A new code, as it is emailed: `7KQ2-…`. */
export function newCode(): string {
  const bytes = randomBytes(LENGTH)
  // 256 is a multiple of 32, so each byte's low five bits are uniform.
  const chars = [...bytes].map((byte) => ALPHABET[byte % 32])
  return [0, 4, 8, 12].map((at) => chars.slice(at, at + 4).join('')).join('-')
}

/** A code as typed, read as the code it is; null when it can't be one. */
export function readCode(typed: string): string | null {
  const code = typed.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
  if (code.length !== LENGTH || [...code].some((ch) => !ALPHABET.includes(ch))) return null
  return code
}

/** What is kept of a code: its SHA-256. A code has 80 random bits, so no slower hash is needed. */
export function codeHash(code: string): string {
  return createHash('sha256')
    .update(readCode(code) ?? code)
    .digest('hex')
}

/** The end of a code, to tell a buyer's codes apart. */
export const codeHint = (code: string): string => (readCode(code) ?? code).slice(-4)
