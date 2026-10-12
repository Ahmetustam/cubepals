// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * How the create button's press reaches the control plane. A create is one server per key however
 * often it is sent (`MinecraftServerService.#create`), so a press is never given up on while it
 * has had no answer:
 *
 * - a press that got no answer at all (the connection dropped, the control plane restarting under
 *   a deploy, a 502 on the way) is sent again under its key while the button still says it is
 *   creating, and only after a few tries says Cubepals couldn't be reached;
 * - a press is remembered in this browser until it is answered, so pressing again after a reload,
 *   in another tab or after going back sends the same key, and lands on the server the first press
 *   made instead of making a second one;
 * - a press a reload cut short is sent again when the page opens, as it was.
 *
 * `useCreate` is the create mutation with these rules; the rest is what it and the page's submit
 * use, and what the tests hold to them.
 *
 * Not for refusals: any answer from the control plane ends a press, and the page says it.
 */
import type { CreateServerInput } from '@blockly/contracts'
import { MINUTE_MS } from '@blockly/contracts/durations'
import { useMutation } from '@tanstack/react-query'
import { TRPCClientError } from '@trpc/client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useTRPC } from '../../../../lib/api'
import { newId } from '../../../../lib/ids'

/** Where a press waits for its answer: the browser's, shared by its tabs. */
const STORED = 'blockly:create'

/** How long a remembered press's key is reused for the same request. */
const KEPT_MS = 10 * MINUTE_MS

/** How long after a press a page that opens sends it again: a reload, not a later visit. */
const RESUMED_MS = 2 * MINUTE_MS

/** Tries a press gets before the page says it got no answer. */
const TRIES = 8

interface Press {
  input: CreateServerInput
  at: number
}

/**
 * The create mutation, and `send` for a press. Its server's page is where it lands, unless they went elsewhere while it
 * was made: then it waits in their list. `resume` shows a press a reload cut short, as the page
 * opens, before it is sent again.
 */
export function useCreate(resume: (input: CreateServerInput) => void) {
  const trpc = useTRPC()
  const router = useRouter()
  const create = useMutation(
    trpc.servers.create.mutationOptions({
      retry: retryCreate,
      retryDelay,
      onSuccess: (server, input) => {
        answered(input)
        if (window.location.pathname === '/servers/new') router.push(`/servers/${server.id}`)
      },
      onError: (error, input) => {
        if (!unanswered(error)) answered(input)
      },
    }),
  )
  // Once, as the page opens: `resume` is the page's, new every render.
  const opened = useRef<typeof resume | null>(resume)
  const { mutate } = create
  useEffect(() => {
    const input = cutShort()
    if (opened.current === null || input === null) return
    opened.current(input)
    opened.current = null
    mutate(input)
  }, [mutate])
  // Enter in the name field submits while the button is busy too: one press, one request.
  const send = (asked: Omit<CreateServerInput, 'idempotencyKey'>) => {
    if (!create.isPending && !create.isSuccess) mutate(press(asked))
  }
  return { ...create, send }
}

/** No answer from the control plane: what messageOf words as Cubepals couldn't be reached. */
export function unanswered(error: unknown): boolean {
  return error instanceof TRPCClientError && error.shape === undefined
}

/** TanStack Query's `retry` for the create: unanswered presses only, a few times. */
export const retryCreate = (failures: number, error: unknown) => unanswered(error) && failures < TRIES - 1

/** Waits between tries, growing: 1, 2, 4, then 8 seconds, about 39 in all: a control plane restarting. */
export const retryDelay = (failures: number) => Math.min(1000 * 2 ** failures, 8000)

/**
 * The request to send for a press: under the remembered key when the same request was pressed a
 * little while ago and never answered, else under a new one. The press is remembered either way.
 */
export function press(asked: Omit<CreateServerInput, 'idempotencyKey'>, now = Date.now()) {
  const last = remembered()
  const idempotencyKey =
    last !== null && now - last.at < KEPT_MS && same(last.input, asked) ? last.input.idempotencyKey : newId()
  const input: CreateServerInput = { ...asked, idempotencyKey }
  write({ input, at: now })
  return input
}

/** A press got its answer, a server or a refusal: the next press is a new request. */
export function answered(input: CreateServerInput) {
  if (remembered()?.input.idempotencyKey === input.idempotencyKey) write(null)
}

/** The press a reload cut short, to send again as the page opens, or null. */
export function cutShort(now = Date.now()): CreateServerInput | null {
  const last = remembered()
  return last !== null && now - last.at < RESUMED_MS ? last.input : null
}

const same = (one: CreateServerInput, asked: Omit<CreateServerInput, 'idempotencyKey'>) => {
  const { idempotencyKey: _, ...rest } = one
  return JSON.stringify(rest) === JSON.stringify(asked)
}

/** The last press, for this tab alone where the browser keeps nothing (a private window, a policy). */
let inTab: Press | null = null

function remembered(): Press | null {
  try {
    if (globalThis.localStorage === undefined) return inTab
    const raw = globalThis.localStorage.getItem(STORED)
    return raw ? (JSON.parse(raw) as Press) : null
  } catch {
    return inTab
  }
}

function write(pressed: Press | null) {
  inTab = pressed
  try {
    if (pressed === null) globalThis.localStorage?.removeItem(STORED)
    else globalThis.localStorage?.setItem(STORED, JSON.stringify(pressed))
  } catch {}
}
