// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

'use client'

/**
 * How long each kind of work took over the last day, week or month, as the admin Health page
 * shows it: a row a kind with its count, failures, median, p90, slowest and a small trend of the
 * median, then its splits by region and setup underneath where the API found enough to split.
 */
import type {
  DurationStatsView,
  HealthWindow,
  KindDurationsView,
  WindowDurationsView,
} from '@blockly/contracts'
import { useState } from 'react'
import { FormSection, Tabs } from '../../../../ui'
import { kindLabel, took } from './words'

const WINDOWS: Array<{ value: HealthWindow; label: string }> = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
]

export function Durations({ windows }: { windows: readonly WindowDurationsView[] }) {
  const [window, setWindow] = useState<HealthWindow>('24h')
  const kinds = windows.find((w) => w.window === window)?.kinds ?? []
  return (
    <FormSection
      title="How long things take"
      description="From being asked for to finished, queue included: what a person waited. Only what succeeded is timed."
    >
      <Tabs label="Over the last" items={WINDOWS} value={window} onChange={setWindow} />
      <div className="bk-health-table__wrap">
        <table className="bk-health-table">
          <thead>
            <tr>
              <th scope="col">Kind</th>
              <th scope="col">Done</th>
              <th scope="col">Failed</th>
              <th scope="col">Median</th>
              <th scope="col">p90</th>
              <th scope="col">Slowest</th>
              <th scope="col">Trend</th>
            </tr>
          </thead>
          <tbody>
            {kinds.map((kind) => (
              <KindRows key={kind.kind} kind={kind} />
            ))}
          </tbody>
        </table>
      </div>
    </FormSection>
  )
}

function KindRows({ kind }: { kind: KindDurationsView }) {
  const idle = kind.count === 0 && kind.failed === 0
  return (
    <>
      <tr className={idle ? 'bk-health-table__idle' : undefined}>
        <th scope="row">{kindLabel(kind.kind)}</th>
        <Figures stats={kind} />
        <td>{idle ? null : <Trend points={kind.trend} />}</td>
      </tr>
      {kind.byRegion.map((split) => (
        <tr key={`region-${split.region}`} className="bk-health-table__split">
          <th scope="row">in {split.region}</th>
          <Figures stats={split} />
          <td />
        </tr>
      ))}
      {kind.bySetup.map((split) => (
        <tr key={`setup-${split.setup}`} className="bk-health-table__split">
          <th scope="row">{split.setup}</th>
          <Figures stats={split} />
          <td />
        </tr>
      ))}
    </>
  )
}

function Figures({ stats }: { stats: DurationStatsView }) {
  return (
    <>
      <td>{stats.count}</td>
      <td className={stats.failed > 0 ? 'bk-health-table__failed' : undefined}>{stats.failed}</td>
      <td>{took(stats.medianSeconds)}</td>
      <td>{took(stats.p90Seconds)}</td>
      <td>{took(stats.slowestSeconds)}</td>
    </>
  )
}

/** The median over the window as a small line, the slowest at the top; gaps where nothing finished. */
function Trend({ points }: { points: KindDurationsView['trend'] }) {
  const width = 64
  const height = 20
  const top = Math.max(...points.map((p) => p.medianSeconds ?? 0), 1)
  const step = points.length > 1 ? width / (points.length - 1) : width
  const segments: string[] = []
  let open = false
  points.forEach((point, i) => {
    if (point.medianSeconds === null) {
      open = false
      return
    }
    const x = (i * step).toFixed(1)
    const y = (height - 2 - (point.medianSeconds / top) * (height - 4)).toFixed(1)
    segments.push(`${open ? 'L' : 'M'}${x} ${y}`)
    open = true
  })
  const latest = [...points].reverse().find((p) => p.medianSeconds !== null)
  return (
    <svg
      className="bk-health-trend"
      width={width}
      height={height}
      viewBox={`-2 0 ${width + 4} ${height}`}
      role="img"
      aria-label={latest ? `Latest median ${took(latest.medianSeconds)}` : 'Nothing finished'}
    >
      <path d={segments.join(' ')} />
      {points.map((point, i) =>
        point.medianSeconds === null ? null : (
          <circle
            key={point.at}
            cx={i * step}
            cy={height - 2 - (point.medianSeconds / top) * (height - 4)}
            r={1.5}
          />
        ),
      )}
    </svg>
  )
}
