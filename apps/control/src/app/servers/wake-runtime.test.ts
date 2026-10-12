// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The step that spares the image work, run in a real shell against folders standing in for the
 * volume, the machine's disk and the JDK, with a stand-in for the image's own helper that says it
 * was called.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WAKE_STEP } from '../../minecraft/wake-step.ts'

let root = ''
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'blockly-wake-'))
  for (const dir of ['data/config', 'jdk', 'bin']) mkdirSync(join(root, dir), { recursive: true })
  writeFileSync(join(root, 'jdk/release'), 'IMPLEMENTOR="Eclipse Adoptium"\nJAVA_VERSION="25.0.4"\n')
  writeFileSync(join(root, 'bin/mc-image-helper'), '#!/bin/sh\necho "helper $*"\n')
  chmodSync(join(root, 'bin/mc-image-helper'), 0o755)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

/** Runs the step, then `then` with what it exported, the way the image's scripts would see it. */
function run(then: string, env: Record<string, string> = {}): string {
  const step = WAKE_STEP.replaceAll('/tmp/blockly-bin', join(root, 'shim'))
    .replaceAll('/data', join(root, 'data'))
    .replaceAll('/usr/bin/mc-image-helper', join(root, 'bin/mc-image-helper'))
  const result = Bun.spawnSync(['/bin/sh', '-c', `${step} ${then}`], {
    env: { PATH: process.env.PATH ?? '', JAVA_HOME: join(root, 'jdk'), ...env },
  })
  return result.stdout.toString().trim()
}

describe('the helper’s stand-in', () => {
  test('says which Java runs from the JDK’s own file', () => {
    expect(run('mc-image-helper java-release')).toBe('25')
  })

  test('leaves a Java 8, which its file says as 1.8, to the helper', () => {
    writeFileSync(join(root, 'jdk/release'), 'JAVA_VERSION="1.8.0_462"\n')
    expect(run('mc-image-helper java-release')).toBe('helper java-release')
  })

  test('copies from a folder nobody mounted without the helper, and from one that is there with it', () => {
    const sync = (source: string) =>
      run(
        `mc-image-helper sync-and-interpolate --skip-newer-in-destination --replace-env-prefix=CFG_ ${source} /out`,
      )
    expect(sync(join(root, 'nowhere'))).toBe('')
    expect(sync(join(root, 'data'))).toStartWith('helper sync-and-interpolate')
  })

  test('hands everything else to the helper, with a JVM for a short life', () => {
    expect(run('mc-image-helper set-properties --x=1 server.properties')).toBe(
      'helper set-properties --x=1 server.properties',
    )
    expect(run('echo "$MC_IMAGE_HELPER_OPTS"')).toBe('-XX:TieredStopAtLevel=1 -XX:+UseSerialGC')
  })
})

describe('Paper’s default configs', () => {
  const defaults = ['bukkit.yml', 'spigot.yml', 'config/paper-global.yml', 'config/paper-world-defaults.yml']
  const skipped = (type: string) => run('echo "$SKIP_DOWNLOAD_DEFAULTS"', { TYPE: type })

  test('are fetched while any of them is missing', () => {
    for (const file of defaults.slice(1)) writeFileSync(join(root, 'data', file), 'kept: true\n')
    expect(skipped('PAPER')).toBe('')
  })

  test('are left alone once all four are on the volume, which the image would copy over nothing', () => {
    for (const file of defaults) writeFileSync(join(root, 'data', file), 'kept: true\n')
    expect(skipped('PAPER')).toBe('true')
    expect(skipped('VANILLA')).toBe('')
  })
})
