// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import { GAME_PORT } from './ports.ts'

/** Minecraft clients assume the game port, so the address people copy leaves it out. */
export function formatJoinAddress(address: { hostname: string; port: number }): string {
  return address.port === GAME_PORT ? address.hostname : `${address.hostname}:${address.port}`
}
