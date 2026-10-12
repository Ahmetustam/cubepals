// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

// For tests only: a failed call as the pages' own tRPC client gets it, so a test never holds an
// error shape typed out by hand that tRPC may no longer send. A refusal comes from the control
// plane's real router, by `refusing` in @blockly/control/testing/refusing.
import type { AppRouter } from '@blockly/control/router'
import { createTRPCClient, httpBatchLink, type TRPCClientError } from '@trpc/client'

/** A failed call, as the pages' own client gets it when `/api` answers with `answer`. */
export async function failedWith(
  answer: (url: string | URL | Request, init?: RequestInit) => Promise<Response>,
): Promise<TRPCClientError<AppRouter>> {
  const client = createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: 'https://cubepals.test/api/trpc', fetch: answer })],
  })
  return client.servers.start.mutate({ serverId: crypto.randomUUID(), requestId: crypto.randomUUID() }).then(
    () => {
      throw new Error('it answered')
    },
    (error: TRPCClientError<AppRouter>) => error,
  )
}
