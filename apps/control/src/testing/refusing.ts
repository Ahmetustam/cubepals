// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

// The API refusing every signed-in call, as its HTTP handler answers: the pages' tests read a
// refusal through their own tRPC client from this, rather than from a shape typed out by hand.
import type { AppErrorCode } from '@blockly/contracts'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { AppError } from '../app/errors.ts'
import { appRouter } from '../interfaces/trpc/router.ts'
import type { Services } from '../interfaces/trpc/trpc.ts'

/** A `fetch` for the pages' tRPC client, answered by the real router, whose services refuse with `code`. */
export function refusing(code: AppErrorCode, message: string) {
  const refuse = () => {
    throw new AppError(code, message)
  }
  const services = new Proxy({}, { get: () => new Proxy({}, { get: () => refuse }) }) as Services
  return async (url: string | URL | Request, init?: RequestInit): Promise<Response> =>
    fetchRequestHandler({
      endpoint: '/api/trpc',
      req: new Request(String(url), init),
      router: appRouter,
      createContext: async () => ({
        actor: { kind: 'user' as const, userId: crypto.randomUUID() },
        services,
      }),
    })
}
