// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Platform health over a fixed history, read at a fixed moment: every count, median, p90 and hour
 * is worked out by hand below, so a change to the SQL that moves any of them fails here. The steps
 * an operation records are the runner's own writes (`operations/persistence.ts`).
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { DAY_S, HOUR_S } from '@blockly/contracts/durations'
import { type Db, schema } from '@blockly/db'
import { eq } from 'drizzle-orm'
import { freshDatabase, hasDatabase } from '../../testing/fleet.ts'
import type { Actor } from '../actor.ts'
import { WOKEN_BY } from '../operations/handlers/bringing-up.ts'
import { markRunning, recordStep } from '../operations/persistence.ts'
import { PlatformHealth } from './health.ts'

const NOW = new Date('2026-10-11T12:00:00.000Z')
const ADMIN: Actor = { kind: 'admin', userId: 'admin' }
const OPERATOR: Actor = { kind: 'operator', name: 'ada' }

const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000)

let db: Db
let drop: (() => Promise<void>) | undefined
let health: PlatformHealth
const ids: Record<string, string> = {}
let broken = ''

/** A server where `region` says, made `from` with `loader`, in `status`. */
async function server(
  name: string,
  region: string,
  status: typeof schema.minecraftServers.$inferInsert.status,
  from: 'template' | 'modpack' = 'template',
  loader: 'paper' | 'fabric' = 'paper',
  deleted = false,
) {
  const [made] = await db
    .insert(schema.minecraftServers)
    .values({
      ownerId: 'owner',
      name,
      slug: name.toLowerCase(),
      inviteCode: randomUUID(),
      regionKey: region,
      memoryTier: '4gb',
      status,
      createIdempotencyKey: randomUUID(),
      createdFrom: from,
      ...(deleted ? { deletedAt: ago(DAY_S) } : {}),
    })
    .returning({ id: schema.minecraftServers.id })
  const id = made?.id ?? ''
  const [revision] = await db
    .insert(schema.serverRevisions)
    .values({
      serverId: id,
      number: 1,
      gameVersion: '1.21.8',
      loader,
      settings: {} as never,
      reason: 'created',
      createdBy: 'test',
    })
    .returning({ id: schema.serverRevisions.id })
  await db
    .update(schema.minecraftServers)
    .set({ desiredRevisionId: revision?.id ?? null })
    .where(eq(schema.minecraftServers.id, id))
  ids[name] = id
  return id
}

/** An operation asked for `askedAgo` seconds before now that took `took` seconds, if it finished. */
async function operation(
  serverId: string,
  kind: typeof schema.serverOperations.$inferInsert.kind,
  askedAgo: number,
  took: number | null,
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' = 'succeeded',
  more: Partial<typeof schema.serverOperations.$inferInsert> = {},
) {
  const id = randomUUID()
  await db.insert(schema.serverOperations).values({
    id,
    serverId,
    kind,
    status,
    requestedBy: 'user:owner',
    idempotencyKey: id,
    createdAt: ago(askedAgo),
    ...(took === null ? {} : { startedAt: ago(askedAgo), finishedAt: ago(askedAgo - took) }),
    ...more,
  })
  return id
}
const wake = (
  serverId: string,
  askedAgo: number,
  took: number,
  status: 'succeeded' | 'failed' | 'cancelled' = 'succeeded',
) => operation(serverId, 'start', askedAgo, took, status, { requestedBy: WOKEN_BY })

/** The history every test reads: six servers, their work over forty days, their runs and spend. */
async function seed() {
  await db.insert(schema.users).values({ id: 'owner', name: 'Owner', email: 'owner@example.test' })
  const a = await server('Alder', 'fra', 'running')
  const b = await server('Birch', 'fra', 'stopped')
  const c = await server('Cedar', 'iad', 'stored', 'modpack', 'fabric')
  await server('Dogwood', 'iad', 'failed', 'modpack', 'fabric')
  const e = await server('Elm', 'iad', 'starting', 'modpack', 'fabric')
  await server('Fir', 'iad', 'deleted', 'template', 'paper', true)

  // Wakes in the last day: 10, 20 and 30 s in fra; 40, 50 and 60 s in iad. Two finished in the
  // last hour, the rest a minute apart, two and a half hours ago.
  await wake(a, 30 * 60 + 10, 10)
  await wake(a, 2.5 * HOUR_S + 20, 20)
  await wake(b, 2.5 * HOUR_S + 60 + 30, 30)
  await wake(e, 40 * 60 + 40, 40)
  await wake(e, 2.5 * HOUR_S + 120 + 50, 50)
  await wake(e, 2.5 * HOUR_S + 180 + 60, 60)
  broken = await wake(a, 3 * HOUR_S, 5, 'failed')
  await db
    .update(schema.serverOperations)
    .set({ error: 'It didn’t start', detail: 'machine exited 137', progress: { step: 'booting', at: '' } })
    .where(eq(schema.serverOperations.id, broken))
  await wake(b, 4 * HOUR_S, 3, 'cancelled')
  // A start someone asked for, five days ago; a create twenty days ago; a wake forty days ago.
  await operation(b, 'start', 5 * DAY_S, 15)
  await operation(a, 'provision', 20 * DAY_S, 120)
  await wake(a, 40 * DAY_S, 999)
  // A wake from rest and a rest, a day and a half ago.
  await operation(c, 'unstore', 1.5 * DAY_S, 90)
  await operation(c, 'store', 1.5 * DAY_S + 600, 45)
  // A backup that failed two days ago: a failure to list, but not timed work.
  await operation(b, 'backup', 2 * DAY_S, 8, 'failed', { error: 'The backup failed' })
  // Still to do: a restart queued a minute ago, an apply running for five.
  await operation(b, 'restart', 60, null, 'queued')
  await operation(e, 'apply', 300, null, 'running')

  // Runs: 10:00 today on, still open (2 h today); 22:00 yesterday to 01:00 (1 h today, 3 h this
  // month); 20:00 on 30 September to 02:00 on 1 October (2 h this month).
  await db.insert(schema.powerIntervals).values([
    { serverId: a, memoryTier: '4gb', startedAt: new Date('2026-10-11T10:00:00Z') },
    {
      serverId: b,
      memoryTier: '4gb',
      startedAt: new Date('2026-10-10T22:00:00Z'),
      stoppedAt: new Date('2026-10-11T01:00:00Z'),
    },
    {
      serverId: b,
      memoryTier: '4gb',
      startedAt: new Date('2026-09-30T20:00:00Z'),
      stoppedAt: new Date('2026-10-01T02:00:00Z'),
    },
  ])
  const spend = (day: string, compute: number, storage: number) => ({
    day,
    computeCents: compute,
    strayCents: 0,
    storageCents: storage,
    strayMachines: 0,
    runningServers: 1,
    computedAt: NOW,
  })
  await db
    .insert(schema.spendDays)
    .values([spend('2026-10-11', 120, 30), spend('2026-10-10', 180, 20), spend('2026-09-30', 900, 99)])
}

beforeAll(async () => {
  if (!hasDatabase) return
  const fresh = await freshDatabase()
  db = fresh.db
  drop = fresh.drop
  health = new PlatformHealth({ db })
  await seed()
}, 30_000)

afterAll(async () => {
  await drop?.()
})

describe.skipIf(!hasDatabase)('platform health: now, and who reads it', () => {
  test('only whoever runs the platform reads it', async () => {
    const owner: Actor = { kind: 'user', userId: 'owner' }
    await expect(health.view(owner, NOW)).rejects.toThrow('Health')
    await expect(health.operations(owner, { limit: 5 }, NOW)).rejects.toThrow('Health')
    expect((await health.view(OPERATOR, NOW)).at).toBe(NOW.toISOString())
  })

  test('counts servers by state and region, and the work not finished yet', async () => {
    const { now } = await health.view(ADMIN, NOW)
    expect(now.servers).toEqual({ running: 1, asleep: 1, resting: 1, failed: 1, busy: 1 })
    expect(now.regions).toEqual([
      { region: 'iad', running: 0, asleep: 0, resting: 1, failed: 1, busy: 1 },
      { region: 'fra', running: 1, asleep: 1, resting: 0, failed: 0, busy: 0 },
    ])
    expect(now.operations).toEqual([
      { kind: 'apply', queued: 0, running: 1, oldestAt: ago(300).toISOString() },
      { kind: 'restart', queued: 1, running: 0, oldestAt: ago(60).toISOString() },
    ])
  })
})

describe.skipIf(!hasDatabase)('platform health: how long work takes', () => {
  test('times each kind in each window: count, failures, median, p90 and the slowest', async () => {
    const { windows } = await health.view(ADMIN, NOW)
    const kind = (window: string, k: string) =>
      windows.find((w) => w.window === window)?.kinds.find((x) => x.kind === k)
    const timed = (window: string, k: string) => {
      const { trend: _, byRegion: __, bySetup: ___, ...stats } = kind(window, k) ?? {}
      return stats
    }
    expect(windows.map((w) => w.window)).toEqual(['24h', '7d', '30d'])
    // 10..60 s: the median halfway between 30 and 40, the p90 halfway between 50 and 60.
    const wakes = { count: 6, failed: 1, medianSeconds: 35, p90Seconds: 55, slowestSeconds: 60 }
    expect(timed('24h', 'wake')).toEqual({ kind: 'wake', ...wakes })
    expect(timed('7d', 'wake')).toEqual({ kind: 'wake', ...wakes })
    expect(timed('30d', 'wake')).toEqual({ kind: 'wake', ...wakes })
    const once = (seconds: number) => ({
      count: 1,
      failed: 0,
      medianSeconds: seconds,
      p90Seconds: seconds,
      slowestSeconds: seconds,
    })
    const none = { count: 0, failed: 0, medianSeconds: null, p90Seconds: null, slowestSeconds: null }
    expect(timed('24h', 'start')).toEqual({ kind: 'start', ...none })
    expect(timed('7d', 'start')).toEqual({ kind: 'start', ...once(15) })
    expect(timed('7d', 'create')).toEqual({ kind: 'create', ...none })
    expect(timed('30d', 'create')).toEqual({ kind: 'create', ...once(120) })
    expect(timed('7d', 'wake_from_rest')).toEqual({ kind: 'wake_from_rest', ...once(90) })
    expect(timed('7d', 'rest')).toEqual({ kind: 'rest', ...once(45) })
    expect(timed('30d', 'restart')).toEqual({ kind: 'restart', ...none })
  })

  test('splits by region and by setup where each group has enough', async () => {
    const { windows } = await health.view(ADMIN, NOW)
    const wakes = windows[0]?.kinds.find((k) => k.kind === 'wake')
    expect(wakes?.byRegion).toEqual([
      { region: 'fra', count: 3, failed: 1, medianSeconds: 20, p90Seconds: 28, slowestSeconds: 30 },
      { region: 'iad', count: 3, failed: 0, medianSeconds: 50, p90Seconds: 58, slowestSeconds: 60 },
    ])
    expect(wakes?.bySetup).toEqual([
      {
        setup: 'modpack · fabric',
        count: 3,
        failed: 0,
        medianSeconds: 50,
        p90Seconds: 58,
        slowestSeconds: 60,
      },
      {
        setup: 'template · paper',
        count: 3,
        failed: 1,
        medianSeconds: 20,
        p90Seconds: 28,
        slowestSeconds: 30,
      },
    ])
    // One start says nothing about a region.
    expect(windows[1]?.kinds.find((k) => k.kind === 'start')?.byRegion).toEqual([])
  })

  test('trends the median by the hour over a day, and by the day over a week and a month', async () => {
    const { windows } = await health.view(ADMIN, NOW)
    const [day, week, month] = windows.map((w) => w.kinds.find((k) => k.kind === 'wake')?.trend ?? [])
    expect(day).toHaveLength(24)
    expect(week).toHaveLength(7)
    expect(month).toHaveLength(30)
    // The last hour: 10 and 40 s. Two hours before it: 20, 30, 50 and 60 s.
    expect(day?.at(-1)).toEqual({ at: ago(HOUR_S).toISOString(), count: 2, medianSeconds: 25 })
    expect(day?.at(-3)).toEqual({ at: ago(3 * HOUR_S).toISOString(), count: 4, medianSeconds: 40 })
    expect(day?.at(-2)).toEqual({ at: ago(2 * HOUR_S).toISOString(), count: 0, medianSeconds: null })
    expect(week?.at(-1)).toEqual({ at: ago(DAY_S).toISOString(), count: 6, medianSeconds: 35 })
    expect(month?.at(0)).toEqual({ at: ago(30 * DAY_S).toISOString(), count: 0, medianSeconds: null })
  })
})

describe.skipIf(!hasDatabase)('platform health: operations and their steps', () => {
  test('lists the last week’s failures, newest first, and its slowest work', async () => {
    const { failures, slowest } = await health.view(ADMIN, NOW)
    expect(failures.map((f) => [f.kind, f.serverName, f.error])).toEqual([
      ['wake', 'Alder', 'It didn’t start'],
      ['backup', 'Birch', 'The backup failed'],
    ])
    expect(failures[0]).toMatchObject({
      id: broken,
      step: 'booting',
      detail: 'machine exited 137',
      seconds: 5,
    })
    expect(slowest.map((op) => [op.kind, op.seconds])).toEqual([
      ['wake_from_rest', 90],
      ['wake', 60],
      ['wake', 50],
      ['rest', 45],
      ['wake', 40],
      ['wake', 30],
      ['wake', 20],
      ['start', 15],
      ['wake', 10],
    ])
  })

  test('finds operations by kind, since when, how slow and how they ended', async () => {
    const found = (input: Parameters<PlatformHealth['operations']>[1]) =>
      health.operations(ADMIN, input, NOW).then((ops) => ops.map((op) => op.seconds))
    expect(await found({ kind: 'wake', limit: 50 })).toEqual([10, 40, 20, 30, 50, 60, 5, 3])
    expect(await found({ kind: 'wake', status: 'succeeded', slowerThan: 30, limit: 50 })).toEqual([
      40, 30, 50, 60,
    ])
    expect(await found({ kind: 'wake', since: ago(HOUR_S).toISOString(), limit: 50 })).toEqual([10, 40])
    expect(await found({ kind: 'wake', since: ago(50 * DAY_S).toISOString(), limit: 1 })).toEqual([10])
    // Work not finished counts to now.
    expect(await found({ status: 'running', limit: 50 })).toEqual([300])
  })

  test('records each step the runner reports, and breaks an operation’s time down by them', async () => {
    const id = await operation(ids.Elm ?? '', 'start', 0, null, 'queued')
    await markRunning(db, id)
    await recordStep(db, id, 'compute')
    await recordStep(db, id, 'booting')
    const [row] = await db
      .select({ steps: schema.serverOperations.steps, progress: schema.serverOperations.progress })
      .from(schema.serverOperations)
      .where(eq(schema.serverOperations.id, id))
    expect(row?.steps?.map((s) => s.step)).toEqual(['attempt', 'compute', 'booting'])
    expect(row?.progress?.step).toBe('booting')

    // A wake asked for at 11:00 that began at 11:00:02 and finished at 11:00:45.
    const at = (seconds: number) =>
      new Date(Date.parse('2026-10-11T11:00:00Z') + seconds * 1000).toISOString()
    const slow = await operation(ids.Alder ?? '', 'start', HOUR_S, 45, 'succeeded', {
      requestedBy: WOKEN_BY,
      steps: [
        { step: 'attempt', at: at(2) },
        { step: 'compute', at: at(3) },
        { step: 'booting', at: at(13) },
        { step: 'loading_world', at: at(40) },
      ],
    })
    const breakdown = await health.operation(OPERATOR, slow, NOW)
    expect(breakdown).toMatchObject({ kind: 'wake', serverName: 'Alder', seconds: 45, step: 'loading_world' })
    expect(breakdown.steps).toEqual([
      { step: 'queued', at: at(0), seconds: 2 },
      { step: 'attempt', at: at(2), seconds: 1 },
      { step: 'compute', at: at(3), seconds: 10 },
      { step: 'booting', at: at(13), seconds: 27 },
      { step: 'loading_world', at: at(40), seconds: 5 },
    ])
    // One from before steps were kept says only how long it took.
    expect((await health.operation(ADMIN, broken, NOW)).steps).toEqual([])
    await expect(health.operation(ADMIN, randomUUID(), NOW)).rejects.toThrow('Operation')
  })
})

describe.skipIf(!hasDatabase)('platform health: money', () => {
  test('adds up running hours and spend for today and the month, against the guards', async () => {
    const { money } = await health.view(ADMIN, NOW)
    expect(money).toEqual({
      runningHoursToday: 3,
      runningHoursMonth: 7,
      spendTodayCents: 150,
      spendMonthCents: 350,
      dailyLimitCents: 1000,
      trippedAt: null,
      // Elm is starting, so it holds a place; Cedar rests, so it holds nothing.
      running: 2,
      maxRunning: 10,
      servers: 4,
      maxServers: 30,
    })
  })
})
