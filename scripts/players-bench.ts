// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * How many players a size holds, measured on temporary apps in `blockly-staging`: a Duels server of Cubepals' own config, and headless players (mineflayer)
 * spread over its arenas, fighting and moving, while the server's tick times, CPU and heap are read.
 *
 *   bun scripts/players-bench.ts up <size> [cpus]                  a Duels server and a new probe
 *   bun scripts/players-bench.ts run <name> [counts] [minutes]     players in steps, in the background
 *   bun scripts/players-bench.ts results                           what every probe printed
 *   bun scripts/players-bench.ts down                              both apps destroyed
 *
 * The server's config is Cubepals' own for a new server of the Duels template (`configFor`, as the
 * suspend bench makes one), with max players raised past the bench's largest step and account
 * checks off so a headless player can join; the bench then turns off Bukkit's connection throttle. `cpus` puts the same server on another count of performance CPUs
 * than `guestFor` gives the size, to see what cores buy. A server's name is `duels-<size>[-<cpus>c]`. Each server has a probe of its own
 * (`lib/players-probe.ts`, bundled and run by bun) in a second app, since the game port can't be
 * reached from here and its players must not slow another server's.
 */
import { randomBytes } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { MemoryTier } from '../apps/control/src/domain/server/size.ts'
import { configFor, fly, machinesOf, say } from './suspend-bench.ts'

const ORG = 'blockly-staging'
const MC_APP = 'bly-players-bench-mc'
const PROBE_APP = 'bly-players-bench-probe'
const REGION = 'fra'
/** Max players on the bench's servers: more than its largest step. */
const MAX_PLAYERS = 200
/** What every probe runs on: four cores of its own for a hundred players, split over four processes. */
const PROBE_GUEST = ['--vm-cpu-kind', 'performance', '--vm-cpus', '4', '--vm-memory', '8192']

/** The bundle a probe runs. */
async function probeBundle(): Promise<string> {
  const out = mkdtempSync(join(tmpdir(), 'players-probe-'))
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, 'lib', 'players-probe.ts')],
    target: 'bun',
    outdir: out,
    naming: 'probe.js',
  })
  if (!built.success) throw new AggregateError(built.logs, 'the probe did not build')
  return join(out, 'probe.js')
}

/** Both apps, made together so they share the console's password, an app secret as a server's is. */
function apps(): void {
  const made = JSON.parse(fly(['apps', 'list', '-o', ORG, '--json'])) as { Name: string }[]
  if (made.some((app) => app.Name === PROBE_APP)) return
  const password = randomBytes(24).toString('hex')
  fly(['apps', 'create', MC_APP, '-o', ORG])
  fly(['secrets', 'import', '--stage', '-a', MC_APP], `RCON_PASSWORD=${password}\n`)
  fly(['apps', 'create', PROBE_APP, '-o', ORG])
  fly(['secrets', 'import', '--stage', '-a', PROBE_APP], `RCON_PASSWORD=${password}\n`)
}

/** A Duels server of the size, on `cpus` performance CPUs where given. */
async function server(name: string, tier: MemoryTier, cpus: number | null): Promise<void> {
  const volume = JSON.parse(
    fly(['volumes', 'create', 'data', '-s', '5', '-r', REGION, '-a', MC_APP, '--yes', '--json']),
  ) as { id: string }
  const { config } = await configFor('duels', tier, volume.id, MAX_PLAYERS)
  if (cpus !== null)
    config.guest = { ...config.guest, cpus, memory_mb: Math.max(config.guest?.memory_mb ?? 0, cpus * 2048) }
  const file = join(mkdtempSync(join(tmpdir(), 'players-bench-')), 'config.json')
  writeFileSync(file, JSON.stringify(config))
  say(
    fly([
      'machine',
      'run',
      config.image ?? '',
      '-a',
      MC_APP,
      '-r',
      REGION,
      '--name',
      name,
      '--machine-config',
      file,
    ]).trim(),
  )
}

/**
 * Bukkit's connection throttle off, and the server restarted for a run with a fresh JVM. A probe's
 * players all come from one address, which the throttle lets in once every 4 s: 150 of them would
 * take ten minutes. The image and Paper write `bukkit.yml` at the first start and keep it after.
 */
async function unthrottle(name: string): Promise<void> {
  const id = machinesOf(MC_APP).find((m) => m.name === name)?.id ?? ''
  const exec = (command: string) => fly(['machine', 'exec', id, command, '-a', MC_APP])
  const running = async () => {
    // A server found stopped starts; one already running says so, which is no failure.
    for (let tries = 0; ; tries++) {
      Bun.spawnSync(['fly', 'machine', 'start', id, '-a', MC_APP])
      try {
        // Once the console answers, Paper has read and written its configuration.
        return exec('rcon-cli list')
      } catch (error) {
        if (tries > 60) throw error
        await Bun.sleep(5000)
      }
    }
  }
  await running()
  exec("sed -i 's/connection-throttle: .*/connection-throttle: -1/' /data/bukkit.yml")
  // The server saves for up to a minute as it stops, longer than flyctl waits for a restart.
  Bun.spawnSync(['fly', 'machine', 'stop', id, '-a', MC_APP])
  await running()
  say(`${name} restarted without the connection throttle`)
}

/** A probe for the server `name`: bun, mineflayer and the bundle. Ready once `/bench/ready` is there. */
async function probe(name: string): Promise<void> {
  say(
    fly([
      'machine',
      'run',
      'oven/bun:1.4.3-slim',
      ...['-a', PROBE_APP, '-r', REGION, '--name', `probe-${name}`, ...PROBE_GUEST, '--restart', 'no'],
      ...['--file-local', `/bench/probe.js=${await probeBundle()}`],
      ...['--entrypoint', 'sh', '--', '-c'],
      'cd /bench && bun add mineflayer@4.39.0 && touch /bench/ready && sleep infinity',
    ]).trim(),
  )
}

/** The server's name on the bench: its size, and its CPUs where they aren't the size's own. */
const nameOf = (tier: string, cpus: string | undefined) =>
  `duels-${tier}${cpus === undefined ? '' : `-${cpus}c`}`

const COMMANDS: Record<string, (rest: string[]) => Promise<void>> = {
  // Run again, it keeps the server, restarted, and gives it a new probe with this checkout's code.
  up: async ([tier = '8g', cpus]) => {
    apps()
    const name = nameOf(tier, cpus)
    if (!machinesOf(MC_APP).some((m) => m.name === name))
      await server(name, tier as MemoryTier, cpus === undefined ? null : Number(cpus))
    await unthrottle(name)
    const old = machinesOf(PROBE_APP).find((m) => m.name === `probe-${name}`)
    if (old !== undefined) fly(['machine', 'destroy', old.id, '--force', '-a', PROBE_APP])
    await probe(name)
  },
  run: async ([name = 'duels-8g', counts = '25,50,100', minutes = '5']) => {
    const target = machinesOf(MC_APP).find((m) => m.name === name)
    const runner = machinesOf(PROBE_APP).find((m) => m.name === `probe-${name}`)
    if (target === undefined || runner === undefined) throw new Error(`no ${name}: run \`up\` first`)
    const line = `bun /bench/probe.js load ${target.id}.vm.${MC_APP}.internal ${name} ${counts} ${minutes}`
    // Each line to the machine's log as well: a stopped probe loses its files, not its log.
    const kept = `${line} 2>> /bench/errors.log | tee -a /bench/results.jsonl > /proc/1/fd/1`
    const detached = `cd /bench && setsid nohup sh -c "${kept}" < /dev/null &`
    say(fly(['machine', 'exec', runner.id, `sh -c '${detached}'`, '-a', PROBE_APP]))
  },
  results: async () => {
    for (const runner of machinesOf(PROBE_APP))
      say(fly(['machine', 'exec', runner.id, 'cat /bench/results.jsonl', '-a', PROBE_APP]))
  },
  down: async () => {
    for (const app of [PROBE_APP, MC_APP]) say(fly(['apps', 'destroy', app, '--yes']).trim())
  },
}

const [command = '', ...rest] = process.argv.slice(2)
const run = COMMANDS[command]
if (run === undefined) {
  say(`usage: bun scripts/players-bench.ts ${Object.keys(COMMANDS).join('|')} …`)
  process.exit(2)
}
await run(rest)
