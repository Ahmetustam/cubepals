// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { messageOf, useTRPC } from '../lib/api'
import { Toggle } from './fields'
import { Note } from './surfaces'

/**
 * What the owner sees of friends chipping in, in the Share sheet: whether its page offers it, who
 * chipped in, and the hours left. Nothing at all where the plan takes no chip-ins and nobody has.
 */
export function ChipInsSection({ serverId }: { serverId: string }) {
  const trpc = useTRPC()
  const queries = useQueryClient()
  const own = useQuery(trpc.chipIns.own.queryOptions({ serverId }))
  const setOpen = useMutation(
    trpc.chipIns.setOpen.mutationOptions({
      onSuccess: (next) => queries.setQueryData(trpc.chipIns.own.queryKey({ serverId }), next),
    }),
  )
  const view = own.data
  if (view === undefined || (!view.offered && view.open && view.people.length === 0)) return null
  const waiting = view.open && !view.offered
  return (
    <div className="bk-stack" style={{ gap: 'var(--space-8)' }}>
      <Toggle
        label="Friends can chip in"
        checked={view.open}
        disabled={setOpen.isPending}
        onChange={(next) => setOpen.mutate({ serverId, open: next })}
      />
      <p className="type-body-sm" style={{ color: 'var(--ink-muted)' }}>
        {waiting
          ? 'Friends can chip in while you have Plus. What they chipped in already waits for it.'
          : 'Its page lets friends add hours to it, from $5. Their hours are played once your month’s are used, before any extra you’d pay for.'}
      </p>
      {view.people.length > 0 && (
        <p className="type-body-sm" style={{ color: 'var(--ink-muted)' }}>
          {view.hoursLeft > 0 ? `${view.hoursLeft} hours left from ` : 'Chipped in by '}
          {view.people.map((person) => `${person.name} (${person.hours} hours)`).join(', ')}.
        </p>
      )}
      {setOpen.isError && <Note tone="danger">{messageOf(setOpen.error)}</Note>}
    </div>
  )
}
