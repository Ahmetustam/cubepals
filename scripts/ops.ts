// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Accounts and their servers from the command line, without signing in to the website
 * (docs/production.md § From the command line).
 *
 *   bun scripts/ops.ts accounts [search]            accounts whose email or name holds it
 *   bun scripts/ops.ts account <email|id>           standing, plan, limits, servers, what was done
 *   bun scripts/ops.ts plan <email|id> plus|free    comp an account onto Plus, or back to Free
 *   bun scripts/ops.ts limits <email|id> [--servers n] [--running n] [--hours n]
 *                                                   its own limits over its plan's; `--servers plan`
 *                                                   (or running, hours) gives back the plan's own
 *   bun scripts/ops.ts create <email|id> <name> [--play survival|creative] [--template <key>]
 *                                    [--size 5|10|20|more] [--region <key>]
 *                                                   a server for that account, as the web makes one
 *   bun scripts/ops.ts server <server>              one server, as its owner's page reads it
 *   bun scripts/ops.ts start|stop <server>
 *   bun scripts/ops.ts trash <server> --name <its name>
 *   bun scripts/ops.ts untrash <server>             back out of the trash, while its window lasts
 *   bun scripts/ops.ts rest <server>                a stopped server's world to the archive store now
 *   bun scripts/ops.ts purge <server> --name <its name>
 *                                                   a server in the trash, gone for good now
 *   bun scripts/ops.ts health [--window 24h|7d|30d] [--json]
 *                                                   servers now, how long work takes, what failed,
 *                                                   the slowest, and the money
 *   bun scripts/ops.ts operations [--kind wake] [--since 24h|7d|<ISO>] [--slow <seconds>]
 *                                 [--status failed] [--limit n] [--json]
 *                                                   operations, the newest first
 *   bun scripts/ops.ts operation <op>               one operation, and where its time went
 *
 * With --production, it reaches production through `fly proxy` with production's own values
 * (scripts/lib/production-reach.ts). Otherwise OPERATOR_API and OPERATOR_TOKEN say where, as for
 * `scripts/runtimes.ts`. OPERATOR (or USER) is who the audit log says acted, as `operator:<name>`.
 */
import type { HealthOperationView, HealthView, HealthWindow, OperationStepsView } from '@blockly/contracts'
import { DAY_MS, HOUR_MS, MINUTE_MS } from '@blockly/contracts/durations'
import { healthReport, operationLine, stepsReport } from './lib/health-report.ts'
import { flags, operatorCli } from './lib/operator-cli.ts'
import { reachProduction } from './lib/production-reach.ts'

const [command = 'help', ...rest] = process.argv.slice(2).filter((arg) => arg !== '--production')

const { positional, options } = flags(rest)
const option = (name: string) => options.get(name)?.at(-1)

const { fail, api } = operatorCli('ops', '/ops/v1', 'docs/production.md')

const say = (line: string) => process.stdout.write(`${line}\n`)
const show = (value: unknown) => say(JSON.stringify(value, null, 2))
const first = (what: string) => positional[0] ?? fail(`${command} needs ${what}`)
const encoded = (ref: string) => encodeURIComponent(ref)

/** A limit as given: a whole number, or `plan` for the plan's own. */
function limit(name: string, current: number | null | undefined): number | null {
  const given = option(name)
  if (given === undefined) return current ?? null
  if (given === 'plan') return null
  const value = Number(given)
  if (!Number.isInteger(value)) fail(`--${name} is a whole number, or plan`)
  return value
}

/** `24h`, `7d` or `90m` ago, or a moment as given. */
function since(given: string): string {
  const ago = /^(\d+)([mhd])$/.exec(given)
  if (ago === null) return given
  const unit = { m: MINUTE_MS, h: HOUR_MS, d: DAY_MS }[ago[2] as 'm' | 'h' | 'd']
  return new Date(Date.now() - Number(ago[1]) * unit).toISOString()
}

if (process.argv.includes('--production'))
  await reachProduction().catch((error: Error) => fail(error.message))

switch (command) {
  case 'accounts': {
    const search = positional[0] ? `?search=${encoded(positional[0])}` : ''
    const found = (await api('GET', `/accounts${search}`)) as {
      total: number
      accounts: Array<{ userId: string; email: string; plan: string; status: string; servers: number }>
    }
    for (const a of found.accounts)
      say(`${a.userId}  ${a.email}  ${a.plan}  ${a.status}  ${a.servers} servers`)
    say(`${found.accounts.length} of ${found.total}`)
    break
  }
  case 'account':
    show(await api('GET', `/accounts/${encoded(first('an email or account id'))}`))
    break
  case 'plan': {
    const plan = positional[1] ?? fail('plan needs the account and plus or free')
    show(await api('PUT', `/accounts/${encoded(first('an email or account id'))}/plan`, { plan }))
    break
  }
  case 'limits': {
    const account = encoded(first('an email or account id'))
    const { limits } = (await api('GET', `/accounts/${account}`)) as {
      limits: { maxServers?: number; maxRunning?: number; includedUnits?: number }
    }
    show(
      await api('PUT', `/accounts/${account}/limits`, {
        maxServers: limit('servers', limits.maxServers),
        maxRunning: limit('running', limits.maxRunning),
        includedUnits: limit('hours', limits.includedUnits),
      }),
    )
    break
  }
  case 'create': {
    const name = positional[1] ?? fail('create needs the account and a name')
    const template = option('template')
    show(
      await api('POST', '/servers', {
        owner: first('an email or account id'),
        name,
        ...(template === undefined ? {} : { from: { kind: 'template', key: template } }),
        ...(option('play') === undefined ? {} : { playStyle: option('play') }),
        ...(option('size') === undefined ? {} : { partySize: option('size') }),
        ...(option('region') === undefined ? {} : { regionKey: option('region') }),
      }),
    )
    break
  }
  case 'server':
    show(await api('GET', `/servers/${first('a server id')}`))
    break
  case 'start':
  case 'stop':
  case 'untrash':
  case 'rest':
    show(await api('POST', `/servers/${first('a server id')}/${command}`))
    break
  case 'trash':
  case 'purge': {
    const confirmName = option('name') ?? fail(`${command} needs --name, the server's name exactly`)
    show(await api('POST', `/servers/${first('a server id')}/${command}`, { confirmName }))
    break
  }
  case 'health': {
    const window = (option('window') ?? '24h') as HealthWindow
    if (!['24h', '7d', '30d'].includes(window)) fail('--window is 24h, 7d or 30d')
    const view = (await api('GET', '/health')) as HealthView
    if (option('json')) show(view)
    else for (const line of healthReport(view, window)) say(line)
    break
  }
  case 'operations': {
    const query = new URLSearchParams()
    for (const name of ['kind', 'slow', 'status', 'limit']) {
      const given = option(name)
      if (given !== undefined) query.set(name, given)
    }
    const from = option('since')
    if (from !== undefined) query.set('since', since(from))
    const { operations } = (await api('GET', `/operations?${query}`)) as { operations: HealthOperationView[] }
    if (option('json')) show(operations)
    else {
      for (const op of operations) say(operationLine(op))
      say(`${operations.length} found`)
    }
    break
  }
  case 'operation': {
    const op = (await api('GET', `/operations/${first('an operation id')}`)) as OperationStepsView
    if (option('json')) show(op)
    else for (const line of stepsReport(op)) say(line)
    break
  }
  default:
    say(
      'bun scripts/ops.ts [--production] accounts|account|plan|limits|create|server|start|stop|trash|untrash|rest|purge|health|operations|operation',
    )
    say('See the top of scripts/ops.ts, and docs/production.md.')
    if (command !== 'help') process.exit(1)
}
// The proxy production is reached through would keep this process alive.
process.exit(0)
