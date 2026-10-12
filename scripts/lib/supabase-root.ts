// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import { fileURLToPath } from 'node:url'

/** Supabase's root, which its pooler's certificate chains to: the one the control image carries. */
const ROOT = fileURLToPath(new URL('../../packages/db/certs/supabase-root-2021.crt', import.meta.url))

/**
 * A database URL for node-postgres (pg-boss), which treats `sslmode=require` as `verify-full` and
 * so refuses Supabase's chain unless it is given the root. Bun's own client ignores both.
 */
export function verifiedAgainstSupabase(databaseUrl: string): string {
  const url = new URL(databaseUrl)
  url.searchParams.set('sslmode', 'verify-full')
  url.searchParams.set('sslrootcert', ROOT)
  return url.toString()
}
