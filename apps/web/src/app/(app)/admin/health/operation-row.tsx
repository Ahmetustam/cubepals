// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

'use client'

/**
 * One operation in the admin Health page's lists of failures and slow work. Closed, it says what
 * ran on which server, when, for how long and how it ended. Opened, it reads where the time went
 * (`admin.operationSteps`): a bar a step, as long as the step took, and the error in full.
 */
import type { HealthOperationView } from '@blockly/contracts'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { messageOf, useTRPC } from '../../../../lib/api'
import { whenTaken } from '../../../../lib/present'
import { Note, Skeleton } from '../../../../ui'
import { kindLabel, stepLabel, took } from './words'

export function OperationRow({ op, now }: { op: HealthOperationView; now: number }) {
  const [open, setOpen] = useState(false)
  const body = `operation-${op.id}`
  const ended =
    op.status === 'succeeded' ? null : op.step ? `${op.status} at ${stepLabel(op.step)}` : op.status
  return (
    <div className="bk-fleetrow">
      <button
        type="button"
        className="bk-fleetrow__head"
        aria-expanded={open}
        aria-controls={body}
        onClick={() => setOpen(!open)}
      >
        <span className="bk-fleetrow__main">
          <span className="bk-fleetrow__name">
            {kindLabel(op.kind)} on {op.serverName}
          </span>
          <span className="bk-fleetrow__meta">
            {whenTaken(op.finishedAt ?? op.createdAt, now)}
            {ended && ` · ${ended.charAt(0).toUpperCase()}${ended.slice(1)}`}
            {op.error && ` · ${op.error}`}
          </span>
        </span>
        <span className="bk-fleetrow__cost">{took(op.seconds)}</span>
      </button>
      {open && (
        <div id={body} className="bk-fleetrow__body">
          <Steps op={op} />
          <dl className="bk-fleetrow__facts">
            {op.detail && (
              <>
                <dt>As it was said</dt>
                <dd className="bk-health-detail">{op.detail}</dd>
              </>
            )}
            <dt>Server</dt>
            <dd>
              <Link href={`/admin/servers?search=${op.serverId}`}>{op.serverName}</Link>
            </dd>
            <dt>Operation</dt>
            <dd className="bk-health-detail">{op.id}</dd>
          </dl>
        </div>
      )}
    </div>
  )
}

/** Where its time went, a bar a step. */
function Steps({ op }: { op: HealthOperationView }) {
  const trpc = useTRPC()
  const steps = useQuery(trpc.admin.operationSteps.queryOptions({ operationId: op.id }))
  if (steps.isPending) return <Skeleton width="100%" height={60} />
  if (steps.isError) return <Note tone="danger">{messageOf(steps.error)}</Note>
  if (steps.data.steps.length === 0)
    return <p>No steps were recorded: it ran before Cubepals kept them. It took {took(op.seconds)} in all.</p>
  const longest = Math.max(...steps.data.steps.map((s) => s.seconds), 0.1)
  return (
    <ol className="bk-health-steps">
      {steps.data.steps.map((step) => (
        <li key={`${step.step}-${step.at}`}>
          <span className="bk-health-steps__name">{stepLabel(step.step)}</span>
          <span className="bk-health-steps__bar">
            <span style={{ inlineSize: `${Math.max((step.seconds / longest) * 100, 1)}%` }} />
          </span>
          <span className="bk-health-steps__time">{took(step.seconds)}</span>
        </li>
      ))}
    </ol>
  )
}
