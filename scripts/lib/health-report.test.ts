// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * What `bun scripts/ops.ts health` and `operation` print, from a fixed view: each section's lines
 * exactly, so a person or an agent reading them can count on their shape.
 */
import { describe, expect, test } from 'bun:test'
import type { HealthOperationView, HealthView, KindDurationsView } from '@blockly/contracts'
import { healthReport, stepsReport } from './health-report.ts'

const none = { count: 0, failed: 0, medianSeconds: null, p90Seconds: null, slowestSeconds: null }
const trend = (medians: Array<number | null>) =>
  medians.map((medianSeconds, i) => ({ at: `2026-10-11T0${i}:00:00.000Z`, count: 1, medianSeconds }))

const wake: KindDurationsView = {
  kind: 'wake',
  count: 6,
  failed: 1,
  medianSeconds: 35,
  p90Seconds: 55,
  slowestSeconds: 200,
  trend: trend([10, null, 40, 80]),
  byRegion: [{ region: 'fra', count: 3, failed: 1, medianSeconds: 20, p90Seconds: 28, slowestSeconds: 30 }],
  bySetup: [],
}

const failed: HealthOperationView = {
  id: 'op-1',
  kind: 'wake',
  serverId: 'server-1',
  serverName: 'Alder',
  status: 'failed',
  step: 'booting',
  error: 'It didn’t start',
  detail: 'machine exited 137',
  createdAt: '2026-10-11T08:59:55.000Z',
  finishedAt: '2026-10-11T09:00:00.000Z',
  seconds: 5,
}

const view: HealthView = {
  at: '2026-10-11T12:00:00.000Z',
  now: {
    servers: { running: 1, asleep: 2, resting: 3, failed: 0, busy: 1 },
    regions: [{ region: 'fra', running: 1, asleep: 2, resting: 3, failed: 0, busy: 1 }],
    operations: [{ kind: 'apply', queued: 0, running: 1, oldestAt: '2026-10-11T11:55:00.000Z' }],
  },
  windows: [
    {
      window: '24h',
      kinds: [{ ...wake }, { kind: 'create', ...none, trend: [], byRegion: [], bySetup: [] }],
    },
  ],
  failures: [failed],
  slowest: [],
  money: {
    runningHoursToday: 3,
    runningHoursMonth: 7,
    spendTodayCents: 150,
    spendMonthCents: 350,
    dailyLimitCents: 1000,
    trippedAt: null,
    running: 2,
    maxRunning: 10,
    servers: 4,
    maxServers: 30,
  },
}

describe('the health report ops.ts prints', () => {
  test('says each section in plain lines, skipping kinds nothing ran', () => {
    const lines = healthReport(view, '24h')
    expect(lines.slice(0, 6)).toEqual([
      'Cubepals health at 2026-10-11 12:00 UTC',
      '',
      'Now',
      '  servers   1 running · 2 asleep · 3 resting · 1 busy',
      '  fra       1 running · 2 asleep · 3 resting · 1 busy',
      '  apply          1 running, 0 queued, the oldest asked for 2026-10-11 11:55 UTC',
    ])
    expect(lines).toContain('  wake                         6       1       35s       55s    3m 20s  ▁·▄█')
    expect(lines).toContain('    in fra                     3       1       20s       28s       30s')
    expect(lines.some((line) => line.startsWith('  create'))).toBe(false)
    expect(lines).toContain(
      '  2026-10-11 09:00 UTC  wake                  5s  Alder [server-1] failed at booting: It didn’t start (machine exited 137)  op op-1',
    )
    expect(lines.slice(-4)).toEqual([
      'Money',
      '  running hours   3 today, 7 this month',
      '  spend           $1.50 today of $10.00 a day; $3.50 this month',
      '  caps            2 of 10 running, 4 of 30 servers',
    ])
  })

  test('breaks an operation down a step to a line, and says when none were kept', () => {
    const steps = [
      { step: 'queued', at: '2026-10-11T08:59:55.000Z', seconds: 2 },
      { step: 'booting', at: '2026-10-11T08:59:57.000Z', seconds: 3 },
    ]
    expect(stepsReport({ ...failed, steps }).slice(1)).toEqual([
      '',
      '  queued                 2s  from 08:59:55',
      '  booting                3s  from 08:59:57',
    ])
    expect(stepsReport({ ...failed, steps: [] }).at(-1)).toBe(
      '  No steps recorded: it ran before they were kept.',
    )
  })
})
