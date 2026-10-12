// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * An operation a restart cuts off carries on within seconds. On 2026-10-11 two Nightlies failed
 * when a deploy of the control plane killed its worker mid-step: the operation stayed running for
 * the half hour until its job expired, and the work queued behind it waited too. Each test stops a
 * server, holds the provider's stop so the operation sits in its `stopping` step, ends the worker
 * as a restart would, and starts another.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { OPERATION_HEARTBEAT_SECONDS } from '../../infra/pg/jobs.ts'
import { type Harness, hasDatabase, startHarness } from '../../testing/harness.ts'

describe.skipIf(!hasDatabase)('an operation cut off by a restart', () => {
  let h: Harness

  beforeAll(async () => {
    h = await startHarness()
  }, 30_000)

  afterAll(async () => {
    await h?.close()
  })

  /** A running server whose stop is in its `stopping` step, held there by the provider; its operation. */
  async function stopMidStep(): Promise<{ id: string; operationId: string }> {
    const owner = await h.user()
    const { id } = await h.create(owner)
    await h.until(id, 'running')
    await h.settled(id)
    // Never let go: the stop the ended worker was making hangs as a dead process's would.
    h.runtime.holdStops(1)
    await h.app.servers.stop(owner, id, randomUUID())
    const deadline = Date.now() + 10_000
    for (;;) {
      const stop = (await h.operations(id)).find((op) => op.kind === 'stop')
      if (stop?.status === 'running' && stop.step === 'stopping') return { id, operationId: stop.id }
      if (Date.now() > deadline) throw new Error(`The stop never reached its step: ${JSON.stringify(stop)}`)
      await Bun.sleep(50)
    }
  }

  test('a worker killed mid-step: the next one carries the operation on once its heartbeat lapses', async () => {
    const { id } = await stopMidStep()
    const killed = Date.now()
    await h.restartWorker('killed')
    await h.until(id, 'stopped', 30_000)
    const [stop] = (await h.settled(id)).filter((op) => op.kind === 'stop')
    expect(stop?.status).toBe('succeeded')
    // The heartbeat, a second, and the retry: seconds, not the half-hour deadline.
    expect(Date.now() - killed).toBeLessThan((OPERATION_HEARTBEAT_SECONDS + 8) * 1000)
  }, 40_000)

  test('a worker stopped by a deploy hands back what outlasts its drain, and the next one runs it at once', async () => {
    const { id } = await stopMidStep()
    const stopped = Date.now()
    await h.restartWorker({ drainMs: 1000 })
    await h.until(id, 'stopped', 15_000)
    const [stop] = (await h.settled(id)).filter((op) => op.kind === 'stop')
    expect(stop?.status).toBe('succeeded')
    expect(Date.now() - stopped).toBeLessThan(6000)
  }, 30_000)

  test('cut off on its last attempt, the operation fails as one that ran out of tries does, and its queue moves on', async () => {
    const { id, operationId } = await stopMidStep()
    await h.db.execute(sql`UPDATE pgboss.job SET retry_limit = retry_count WHERE id = ${operationId}`)
    await h.restartWorker('killed')
    const [stop] = (await h.settled(id, 30_000)).filter((op) => op.kind === 'stop')
    expect(stop).toMatchObject({
      status: 'failed',
      error: 'It was cut off when Cubepals restarted. Trying again usually works.',
    })
    const server = await h.server(id)
    expect(server.lifecycle.status).not.toBe('stopping')
    // The operation settles before its job is dropped, so the queue clears a moment after.
    const deadline = Date.now() + 5000
    let blocked = await h.jobs.blockedOperations()
    while (blocked.length > 0 && Date.now() < deadline) {
      await Bun.sleep(50)
      blocked = await h.jobs.blockedOperations()
    }
    expect(blocked).toEqual([])
  }, 40_000)
})
