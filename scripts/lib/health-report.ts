// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Production's health as `bun scripts/ops.ts health`, `operations` and `operation` print it, for a
 * person at a terminal or an agent reading it: plain lines, one figure where one will do. What the
 * figures mean is `apps/control/src/app/platform/health.ts`'s; `--json` prints them as they came.
 */
import type {
  DurationStatsView,
  HealthMoneyView,
  HealthNowView,
  HealthOperationView,
  HealthView,
  HealthWindow,
  OperationStepsView,
  ServerCountsView,
  WindowDurationsView,
} from '@blockly/contracts'
import { HOUR_S, MINUTE_S } from '@blockly/contracts/durations'

/** Seconds as people read a wait: "45s", "3m 10s", "1h 2m". */
function took(seconds: number | null): string {
  if (seconds === null) return '-'
  if (seconds < 10) return `${Math.round(seconds * 10) / 10}s`
  if (seconds < MINUTE_S) return `${Math.round(seconds)}s`
  const whole = Math.round(seconds)
  if (whole < HOUR_S) return `${Math.floor(whole / MINUTE_S)}m ${String(whole % MINUTE_S).padStart(2, '0')}s`
  return `${Math.floor(whole / HOUR_S)}h ${String(Math.floor((whole % HOUR_S) / MINUTE_S)).padStart(2, '0')}m`
}

const BARS = '▁▂▃▄▅▆▇█'

/** Medians as a line of bars, the tallest the slowest; `·` where nothing finished. */
function sparkline(points: ReadonlyArray<{ medianSeconds: number | null }>): string {
  const values = points.map((p) => p.medianSeconds)
  const top = Math.max(...values.map((v) => v ?? 0))
  return values
    .map((v) =>
      v === null
        ? '·'
        : BARS[top === 0 ? 0 : Math.min(BARS.length - 1, Math.floor((v / top) * (BARS.length - 1)))],
    )
    .join('')
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`
const when = (at: string) => `${at.slice(0, 16).replace('T', ' ')} UTC`

function counts(c: ServerCountsView): string {
  const parts = [
    `${c.running} running`,
    `${c.asleep} asleep`,
    `${c.resting} resting`,
    ...(c.failed > 0 ? [`${c.failed} failed`] : []),
    ...(c.busy > 0 ? [`${c.busy} busy`] : []),
  ]
  return parts.join(' · ')
}

const statsRow = (label: string, s: DurationStatsView, trend = '') =>
  `  ${label.padEnd(24)}${String(s.count).padStart(6)}${String(s.failed).padStart(8)}${took(s.medianSeconds).padStart(10)}${took(s.p90Seconds).padStart(10)}${took(s.slowestSeconds).padStart(10)}  ${trend}`.trimEnd()

/** One operation on a line: when, what, where, how long, and how it ended. */
export function operationLine(op: HealthOperationView): string {
  const ended = op.status === 'succeeded' ? '' : ` ${op.status}${op.step ? ` at ${op.step}` : ''}`
  const why = op.error ? `: ${op.error}${op.detail && op.detail !== op.error ? ` (${op.detail})` : ''}` : ''
  return `  ${when(op.finishedAt ?? op.createdAt)}  ${op.kind.padEnd(15)}${took(op.seconds).padStart(9)}  ${op.serverName} [${op.serverId}]${ended}${why}  op ${op.id}`
}

export function healthReport(view: HealthView, window: HealthWindow): string[] {
  return [
    `Cubepals health at ${when(view.at)}`,
    '',
    ...nowLines(view.now),
    '',
    ...durationLines(
      view.windows.find((w) => w.window === window),
      window,
    ),
    '',
    'Failed, the last 7 days',
    ...(view.failures.length === 0 ? ['  nothing'] : view.failures.map(operationLine)),
    '',
    'Slowest, the last 7 days (bun scripts/ops.ts operation <op> breaks one down)',
    ...(view.slowest.length === 0 ? ['  nothing'] : view.slowest.map(operationLine)),
    '',
    ...moneyLines(view.money),
  ]
}

function nowLines(now: HealthNowView): string[] {
  const lines = ['Now', `  ${'servers'.padEnd(10)}${counts(now.servers)}`]
  for (const region of now.regions) lines.push(`  ${region.region.padEnd(10)}${counts(region)}`)
  if (now.operations.length === 0) lines.push('  nothing queued or running')
  for (const op of now.operations)
    lines.push(
      `  ${op.kind.padEnd(15)}${op.running} running, ${op.queued} queued, the oldest asked for ${when(op.oldestAt)}`,
    )
  return lines
}

function durationLines(durations: WindowDurationsView | undefined, window: HealthWindow): string[] {
  const lines = [
    `Durations, the last ${window}: asked for to finished, queue included (--window 24h|7d|30d)`,
    `  ${'kind'.padEnd(24)}${'done'.padStart(6)}${'failed'.padStart(8)}${'median'.padStart(10)}${'p90'.padStart(10)}${'slowest'.padStart(10)}  trend of the median`,
  ]
  for (const kind of durations?.kinds ?? []) {
    if (kind.count === 0 && kind.failed === 0) continue
    lines.push(statsRow(kind.kind, kind, sparkline(kind.trend)))
    for (const region of kind.byRegion) lines.push(statsRow(`  in ${region.region}`, region))
    for (const setup of kind.bySetup) lines.push(statsRow(`  ${setup.setup}`, setup))
  }
  return lines
}

function moneyLines(m: HealthMoneyView): string[] {
  const today = m.spendTodayCents === null ? 'not worked out yet' : dollars(m.spendTodayCents)
  const tripped = m.trippedAt ? `, past it at ${when(m.trippedAt)}` : ''
  return [
    'Money',
    `  running hours   ${m.runningHoursToday} today, ${m.runningHoursMonth} this month`,
    `  spend           ${today} today of ${dollars(m.dailyLimitCents)} a day${tripped}; ${dollars(m.spendMonthCents)} this month`,
    `  caps            ${m.running} of ${m.maxRunning} running, ${m.servers} of ${m.maxServers} servers`,
  ]
}

/** An operation, then where its time went, a step to a line. */
export function stepsReport(op: OperationStepsView): string[] {
  const lines = [operationLine(op).trimStart(), '']
  if (op.steps.length === 0) return [...lines, '  No steps recorded: it ran before they were kept.']
  for (const step of op.steps)
    lines.push(`  ${step.step.padEnd(16)}${took(step.seconds).padStart(9)}  from ${step.at.slice(11, 19)}`)
  return lines
}
