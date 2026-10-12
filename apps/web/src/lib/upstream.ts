// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import { API_PORT } from '@blockly/contracts/local'

/**
 * The control plane this web app fronts: server-side only. Local development defaults to the
 * control plane's local listener; every deployed environment sets API_UPSTREAM.
 */
export function apiUpstream(): string {
  const upstream =
    process.env.API_UPSTREAM ??
    (process.env.NODE_ENV === 'production' ? undefined : `http://127.0.0.1:${API_PORT}`)
  if (upstream === undefined)
    throw new Error('API_UPSTREAM must name the control plane the /api rewrite forwards to')
  return upstream.replace(/\/$/, '')
}
