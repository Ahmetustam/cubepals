// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/** What a waking server's lines say to a player, checked against lines real wakes printed. */

import { describe, expect, test } from 'bun:test'
import { wakeWords } from './wake-words.ts'

describe('what a waking server says', () => {
  const info = (text: string) => wakeWords({ text, level: 'info' })
  const shown = (lines: string[]) =>
    lines
      .map(info)
      .filter((words) => words !== null)
      .map((words) => words?.text)

  // Lines from real wakes on staging (2026-10-11): Mojang's server, then Paper's.
  test('a vanilla start reads in Minecraft words, without the machinery', () => {
    expect(
      shown([
        'Environment: Environment[discoveryUrl=https://discovery.minecraftservices.com/minecraft/client, name=PROD]',
        'Loaded 1866 advancements',
        'Starting minecraft server version 26.3',
        'Loading properties',
        'Default game type: SURVIVAL',
        'Generating keypair',
        'Starting Minecraft server on *:25565',
        'Preparing level "world"',
        'Loading 0 persistent chunks...',
        'Preparing spawn area: 100%',
        'Time elapsed: 18 ms',
        'Done (0.551s)! For help, type "help"',
        'Starting remote control listener',
        'Thread RCON Listener started',
        'RCON running on 0.0.0.0:25575',
        "Saving chunks for level 'ServerLevel[world]'/minecraft:overworld",
      ]),
    ).toEqual([
      'Setting out the advancements',
      'Starting Minecraft 26.3',
      'Reading its settings',
      'Playing in Survival',
      'Opening the door to players',
      'Opening the world',
      'Getting the spawn area ready · 100%',
      'The world is open',
    ])
  })

  test('a Paper start keeps its few plain lines and drops its talk about itself', () => {
    expect(
      shown([
        '[bootstrap] Running Java 21 (OpenJDK 64-Bit Server VM 21.0.12+8-LTS; Eclipse Adoptium Temurin-21.0.12+8) on Linux',
        '[bootstrap] Loading Paper 1.21.11-132-ver/1.21.11@c5eb079 (2026-05-11T11:43:09Z) for Minecraft 1.21.11',
        '[PluginInitializerManager] Initializing plugins...',
        '[PluginInitializerManager] Initialized 0 plugins',
        'Loaded 1470 recipes',
        '[ca.spottedleaf.dataconverter.minecraft.datatypes.MCTypeRegistry] Initialising converters for DataConverter...',
        'This server is running Paper version 1.21.11-132-ver/1.21.11@c5eb079',
        '[spark] This server bundles the spark profiler.',
        'Server Ping Player Sample Count: 12',
        'Using 4 threads for Netty based IO',
        '[MoonriseCommon] Paper is using 1 worker threads, 1 I/O threads',
        'Paper: Using libdeflate (Linux x86_64) compression from Velocity.',
        'Server permissions file permissions.yml is empty, ignoring it',
        'Prepared spawn area in 1 ms',
        'Done preparing level "world" (1.127s)',
        'Running delayed init tasks',
        '[BentoBox] Enabling BentoBox v2.7.1',
      ]),
    ).toEqual([
      'Starting Paper for Minecraft 1.21.11',
      'Setting out the recipes',
      'The world is loaded',
      'Starting BentoBox',
    ])
  })

  test('only the image’s own start of Minecraft is worth a word; warnings never are', () => {
    expect(wakeWords({ text: '[init] Starting the Minecraft server...', level: 'setup' })?.text).toBe(
      'Starting Minecraft',
    )
    expect(wakeWords({ text: '[init] Using Aikar’s flags', level: 'setup' })).toBeNull()
    expect(wakeWords({ text: 'Did not find udev library', level: 'warn' })).toBeNull()
  })

  test('Fly’s own lines about the machine never read as the server’s', () => {
    expect(
      shown([
        ' INFO Starting init (commit: 8b221cb)...',
        ' INFO Checking filesystem on /data',
        '2026-10-11T15:05:03.186737751 [01M4NQXRW4Q8AJQHAA5JZ1C8Z2:main] Running Firecracker v1.14.4',
        'Virtual machine has been suspended',
        // A machine killed while it boots, and started again by Fly.
        'WARN hallpass exited, pid: 643, status: exit status: 0',
        '[   13.998852] reboot: Restarting system',
        'System chat: [Rcon: Saved the game]',
      ]),
    ).toEqual([])
  })

  test('the spawn area counts up in place rather than line after line', () => {
    expect(info('Preparing spawn area: 42%')?.group).toBe(info('Preparing spawn area: 84%')?.group)
  })
})
