// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { PinnedMod } from '../domain/mods/artifact.ts'

/**
 * BentoBox's island game modes, by the Modrinth project a pinned add-on records, with what players
 * call them and the command each player starts their own island over with (the `island` command
 * each mode's config.yml names: `island` for BSkyBlock, `ob` for AOneBlock).
 */
const GAME_MODES: Readonly<Record<string, { mode: string; reset: string }>> = {
  ASGn77Qd: { mode: 'Skyblock', reset: '/island reset' },
  qq7CK8U4: { mode: 'OneBlock', reset: '/ob reset' },
}

/**
 * Whether a server plays on islands, and how: its islands live in BentoBox's own worlds, beside
 * the world Blockly switches, so a new world of Blockly's leaves every island as it was. Null for
 * any other server.
 */
export function islandsOf(mods: readonly PinnedMod[]): { mode: string; reset: string } | null {
  for (const mod of mods) {
    const mode = 'projectId' in mod.source ? GAME_MODES[mod.source.projectId] : undefined
    if (mode !== undefined && mod.source.catalog === 'modrinth') return mode
  }
  return null
}
