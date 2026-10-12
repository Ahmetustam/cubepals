// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * What a waking server prints, in words a player reads: Minecraft's own lines worth a glance,
 * reworded where they are technical, and nothing of Java, the image or Fly's machine. Read by
 * the log under the wake button (servers/[id]/wake-log.tsx). Not the console, which shows all of it.
 */

/** One line a waking server said, as a player reads it; `group` lines replace each other in place. */
export interface WakeWords {
  text: string
  group?: string
}

const DIMENSIONS: Record<string, string> = {
  overworld: 'the Overworld',
  the_nether: 'the Nether',
  the_end: 'the End',
}

/**
 * The lines worth a glance while a server wakes, in Minecraft's words rather than the console's,
 * from what Mojang's server and Paper print as they start (staging, 2026-10-11). A match that
 * says null is one a player has no use for. Anything else that reads as plain words passes as it is.
 */
const WAKE_WORDS: [RegExp, (match: RegExpExecArray) => WakeWords | null][] = [
  [
    /^\[bootstrap\] Loading Paper .* for Minecraft (\S+)/,
    (m) => ({ text: `Starting Paper for Minecraft ${m[1]}` }),
  ],
  [/^Starting minecraft server version (\S+)/i, (m) => ({ text: `Starting Minecraft ${m[1]}` })],
  [
    /^Loading Minecraft (\S+) with (Fabric|Quilt) Loader/,
    (m) => ({ text: `Starting Minecraft ${m[1]} with ${m[2]}` }),
  ],
  [/^Loading properties/, () => ({ text: 'Reading its settings' })],
  [/^Default game type: (\w+)/, (m) => ({ text: `Playing in ${title(m[1] ?? '')}` })],
  [/^Preparing level "/, () => ({ text: 'Opening the world' })],
  [
    /^Preparing start region for dimension minecraft:(\w+)/,
    (m) => ({ text: `Getting ${DIMENSIONS[m[1] ?? ''] ?? 'the world'} ready`, group: 'region' }),
  ],
  [
    /^Preparing spawn area: (\d+)%/,
    (m) => ({ text: `Getting the spawn area ready · ${m[1]}%`, group: 'spawn' }),
  ],
  [
    /^\[PluginInitializerManager\] Initialized ([1-9]\d*) plugins?/,
    (m) => ({ text: `Loading ${m[1]} plugins` }),
  ],
  [/^Loading (\d+) mods?\b/, (m) => ({ text: `Loading ${m[1]} mods` })],
  [/^\[(\w[\w ]*)\] (?:Loading|Enabling) \1\b/, (m) => ({ text: `Starting ${m[1]}`, group: 'plugins' })],
  [/^Loaded \d+ recipes/, () => ({ text: 'Setting out the recipes' })],
  [/^Loaded \d+ advancements/, () => ({ text: 'Setting out the advancements' })],
  [/^Starting Minecraft server on /, () => ({ text: 'Opening the door to players' })],
  [/^Done preparing level/, () => ({ text: 'The world is loaded' })],
  [/^Done \([\d.,]+s\)!/, () => ({ text: 'The world is open', group: 'done' })],
  // Fly's own machine coming up or going down, which shares the server's log.
  [
    /^\s*(?:INFO|WARN|ERROR) |^\[\s*\d+\.\d+\]|^\d{4}[-/]\d\d[-/]\d\d|Firecracker|Virtual machine|hallpass|^Machine /,
    () => null,
  ],
  // Machinery: threads, keys, chunk bookkeeping, timings, Paper and its profiler talking about themselves.
  [
    /threads?\b|Netty|keypair|persistent chunks|Sample Count|permissions\.yml|^Prepared spawn area|^Time elapsed|^Running delayed|^This server is running|^Paper: |^\[(?:bootstrap|spark|MoonriseCommon|PluginInitializerManager)\]|^Saving chunks|remote control/i,
    () => null,
  ],
]

/**
 * What a line printed while a server wakes says to a player, or null for one that would read as
 * a console: Java and the image setting up, addresses, class names and paths, Blockly's own
 * commands. The image's own setup is all machinery but for the moment it starts Minecraft.
 */
export function wakeWords(line: { text: string; level: string }): WakeWords | null {
  const text = line.text.trim()
  if (line.level === 'setup' && /Starting the Minecraft server/.test(text))
    return { text: 'Starting Minecraft' }
  if (line.level !== 'info' || text.length === 0) return null
  for (const [pattern, words] of WAKE_WORDS) {
    const match = pattern.exec(text)
    if (match) return words(match)
  }
  // Plain words only: nothing a player would read as machinery.
  if (text.length > 80 || /:\/\/|[/\\=]|\w\.\w+\.\w|\bjava\b|\bjvm\b|\bRcon\b|For help, type/i.test(text))
    return null
  return { text }
}

const title = (word: string) => `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`
