// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Minecraft's ports: the one place they are written. The runtime spec gives a server these, and
 * the configuration, the edge and the scripts that dial a server read them from here, so this
 * file imports nothing and the edge's image can copy it alone.
 */

/** Where a server listens for players, and the port clients assume when an address leaves it out. */
export const GAME_PORT = 25565

/** Where a server's console (RCON) listens, which only the control plane dials. */
export const RCON_PORT = 25575
