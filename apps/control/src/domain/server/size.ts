// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Server size is a product promise in memory ("a 4 GB server"), chosen by how many people play.
 * CPU and machine class are infrastructure and never appear here.
 */

export const MEMORY_TIERS = ['2g', '3g', '4g', '6g', '8g', '16g'] as const
export type MemoryTier = (typeof MEMORY_TIERS)[number]

export const isMemoryTier = (value: string): value is MemoryTier =>
  (MEMORY_TIERS as readonly string[]).includes(value)

export function memoryMb(tier: MemoryTier): number {
  return Number.parseInt(tier, 10) * 1024
}

/** The size as it is sold: "3 GB". */
export const sizeLabel = (tier: MemoryTier): string => `${Number.parseInt(tier, 10)} GB`

export type PartySize = '5' | '10' | '20' | '50' | 'more'

/**
 * The sizes sold, by how many play. The smallest is 3 GB: measured, 2 GB was OOM-killed at a
 * 1.5 GB heap, while 3 GB with a 2 GB heap was comfortable for 1–5 players.
 */
export const PARTY: Record<PartySize, { maxPlayers: number; tier: MemoryTier }> = {
  '5': { maxPlayers: 5, tier: '3g' },
  '10': { maxPlayers: 10, tier: '4g' },
  // 6 GB runs on the same four-core machine as 8 GB, so twenty get the whole of it.
  '20': { maxPlayers: 20, tier: '8g' },
  '50': { maxPlayers: 50, tier: '8g' },
  more: { maxPlayers: 100, tier: '16g' },
}

/**
 * How many players a size holds; max players never goes above it. 8 GB and 16 GB are measured:
 * headless players fighting on a Duels server kept 8 GB at 20 TPS with ticks under half their
 * time up to 50 and 16 GB, on eight cores, up to 100; past those, ticks ran long. Memory was never what ran out: what a server
 * holds after a collection was half a gigabyte at 100. Cores were.
 */
const CAPACITY: Record<MemoryTier, number> = { '2g': 4, '3g': 5, '4g': 10, '6g': 20, '8g': 50, '16g': 100 }

export function playerCapacity(tier: MemoryTier): number {
  return CAPACITY[tier]
}

/**
 * The size a server moves to when its plan no longer offers the one it is on: the smallest
 * offered size at least as big, else the biggest offered. Null when the plan offers none.
 */
export function closestTier(tier: MemoryTier, offered: readonly MemoryTier[]): MemoryTier | null {
  const bySize = [...offered].sort((a, b) => memoryMb(a) - memoryMb(b))
  return bySize.find((t) => memoryMb(t) >= memoryMb(tier)) ?? bySize.at(-1) ?? null
}
