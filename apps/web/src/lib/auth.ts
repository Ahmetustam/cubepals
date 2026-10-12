// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import { createAuthClient } from 'better-auth/react'

/** Talks to /api/auth on the page's own origin; the rewrite takes it to the control plane. */
export const authClient = createAuthClient()

/** Better Auth's names for its refusals, as its client lists them: one it drops fails the build. */
export type AuthErrorCode = keyof typeof authClient.$ERROR_CODES
