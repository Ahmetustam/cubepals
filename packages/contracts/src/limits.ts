// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * How long what people type may be: the one place each bound is written. The API's inputs, the
 * control plane's own rules (domain/ included, which may import this file and no other package)
 * and the web's field rules all read them from here. Lengths count as a browser counts a text
 * field (UTF-16 units). This file imports nothing, so it stays something anyone can read.
 */

/** A password, as the deployment's auth requires it (Better Auth's `minPasswordLength`). */
export const PASSWORD_MIN_LENGTH = 10

/** A server's address, the slug: a DNS label of its own, which Blockly keeps to 3 to 40. */
export const ADDRESS_MIN_LENGTH = 3
export const ADDRESS_MAX_LENGTH = 40

/** A server's or a world's name. */
export const NAME_MAX_LENGTH = 40

/** What a server's page says about it. */
export const DESCRIPTION_MAX_LENGTH = 1000

/** A world's seed, as typed. */
export const SEED_MAX_LENGTH = 32

/** A Minecraft name, as Mojang allows them: 3 to 16 letters, numbers and underscores. */
export const PLAYER_NAME_MIN_LENGTH = 3
export const PLAYER_NAME_MAX_LENGTH = 16

/** The most a note on a server's guestbook says. */
export const NOTE_MAX_LENGTH = 128
