// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

'use client'

/**
 * Production's health, for whoever runs Cubepals: what servers are doing now, how long work takes,
 * what failed and where a slow operation's time went, and the money at a glance. The operators' API
 * reads the same (`bun scripts/ops.ts health`). How long each kind of work took is
 * `durations.tsx`'s; one failed or slow operation, opened to its steps, is `operation-row.tsx`'s.
 */
import type {
  HealthMoneyView,
  HealthNowView,
  HealthOperationView,
  ServerCountsView,
} from '@blockly/contracts'
import { MINUTE_MS } from '@blockly/contracts/durations'
import { useQuery } from '@tanstack/react-query'
import { isNotFound, messageOf, useTRPC } from '../../../../lib/api'
import { useNow } from '../../../../lib/hooks'
import { whenTaken } from '../../../../lib/present'
import { Badge, EmptyState, FormRow, FormSection, Note, Skeleton, StatusPill } from '../../../../ui'
import { AdminTabs } from '../tabs'
import { Durations } from './durations'
import { OperationRow } from './operation-row'
import { dollars, kindLabel } from './words'

export default function HealthPage() {
  const trpc = useTRPC()
  const now = useNow(30_000)
  const health = useQuery({ ...trpc.admin.health.queryOptions(), refetchInterval: MINUTE_MS })

  if (health.isError && isNotFound(health.error))
    return <EmptyState title="Nothing here" description="This page is for Cubepals' admins." />
  const view = health.data
  return (
    <>
      <h1 className="type-display-md" style={{ color: 'var(--ink)' }}>
        Admin
      </h1>
      <AdminTabs />
      {health.isError && <Note tone="danger">{messageOf(health.error)}</Note>}
      {view === undefined ? (
        health.isPending && <Skeleton width="100%" height={320} />
      ) : (
        <>
          <Now now={view.now} at={Date.parse(view.at)} />
          <Durations windows={view.windows} />
          <Operations
            title="Failed in the last 7 days"
            description="The newest first. Open one to see the step it failed at and what was said."
            empty="Nothing failed."
            ops={view.failures}
            now={now}
          />
          <Operations
            title="Slowest in the last 7 days"
            description="Work that succeeded, the slowest first. Open one to see where its time went."
            empty="Nothing finished."
            ops={view.slowest}
            now={now}
          />
          <Money money={view.money} />
        </>
      )}
    </>
  )
}

const counted = (c: ServerCountsView) =>
  [
    { key: 'running', pill: 'online', label: `${c.running} running` },
    { key: 'asleep', pill: 'stopped', label: `${c.asleep} asleep` },
    { key: 'resting', pill: 'sleeping', label: `${c.resting} resting` },
    { key: 'busy', pill: 'starting', label: `${c.busy} busy` },
    { key: 'failed', pill: 'crashed', label: `${c.failed} failed` },
  ] as const

function Counts({ counts }: { counts: ServerCountsView }) {
  return (
    <span className="bk-row bk-wrap" style={{ gap: 'var(--space-8)' }}>
      {counted(counts)
        .filter((c) => c.key === 'running' || counts[c.key] > 0)
        .map((c) => (
          <StatusPill key={c.key} status={c.pill} label={c.label} />
        ))}
    </span>
  )
}

function Now({ now, at }: { now: HealthNowView; at: number }) {
  return (
    <FormSection
      title="Now"
      description="Every server that isn't in the trash, by the region it was made for."
    >
      <Counts counts={now.servers} />
      {now.regions.length > 1 &&
        now.regions.map((region) => (
          <FormRow key={region.region} label={region.region} control={<Counts counts={region} />} />
        ))}
      <FormRow
        label="In flight"
        description={
          now.operations.length === 0
            ? 'Nothing queued or running.'
            : now.operations
                .map(
                  (op) =>
                    `${kindLabel(op.kind)}: ${[op.running > 0 && `${op.running} running`, op.queued > 0 && `${op.queued} queued`].filter(Boolean).join(', ')}, the oldest asked for ${whenTaken(op.oldestAt, at).toLowerCase()}`,
                )
                .join(' · ')
        }
        control={
          <Badge tone={now.operations.length === 0 ? 'grass' : 'info'}>
            {now.operations.reduce((sum, op) => sum + op.running + op.queued, 0)}
          </Badge>
        }
      />
    </FormSection>
  )
}

function Operations({
  title,
  description,
  empty,
  ops,
  now,
}: {
  title: string
  description: string
  empty: string
  ops: readonly HealthOperationView[]
  now: number
}) {
  return (
    <FormSection title={title} description={description}>
      {ops.length === 0 ? (
        <p className="type-body" style={{ color: 'var(--ink-muted)' }}>
          {empty}
        </p>
      ) : (
        <div className="bk-list">
          {ops.map((op) => (
            <OperationRow key={op.id} op={op} now={now} />
          ))}
        </div>
      )}
    </FormSection>
  )
}

function Money({ money }: { money: HealthMoneyView }) {
  const limit = money.dailyLimitCents
  const today = money.spendTodayCents
  return (
    <FormSection
      title="Money"
      description="Hours servers ran, open runs counted to now, and what the spend watchdog worked out at the provider's list prices."
    >
      <FormRow
        label={`${money.runningHoursToday} h today, ${money.runningHoursMonth} h this month`}
        description="Server hours run, UTC."
        control={null}
      />
      <FormRow
        label={today === null ? 'Not worked out yet today' : `${dollars(today)} of ${dollars(limit)} today`}
        description={`${dollars(money.spendMonthCents)} this month.${money.trippedAt ? ' Today passed the limit: starting and creating servers were turned off.' : ''}`}
        control={
          today === null ? null : (
            <Badge tone={today > limit ? 'danger' : today > limit * 0.8 ? 'info' : 'grass'}>
              {today > limit ? 'Over' : `${Math.round((today / Math.max(limit, 1)) * 100)}%`}
            </Badge>
          )
        }
      />
      <FormRow
        label={`${money.running} of ${money.maxRunning} running, ${money.servers} of ${money.maxServers} servers`}
        description="Against the platform's caps. Resting servers hold nothing and count toward neither."
        control={
          <Badge tone={money.running >= money.maxRunning ? 'danger' : 'grass'}>
            {Math.round((money.running / Math.max(money.maxRunning, 1)) * 100)}%
          </Badge>
        }
      />
    </FormSection>
  )
}
