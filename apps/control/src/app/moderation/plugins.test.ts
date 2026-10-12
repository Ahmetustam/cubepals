// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The moderation plugins' commands and files as Cubepals writes them: punishments by UUID with
 * LibertyBans' lengths, and nothing anywhere that punishes an address.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
  giveCommands,
  helperCommand,
  liftCommand,
  moderationFiles,
  punishCommand,
} from '../../minecraft/moderation.ts'

const uuid = '8667ba71-b85a-4004-af54-457a9734eed7'
const CHAT_FILTER = readFileSync(new URL('./chatsentinel-config.yml', import.meta.url), 'utf8')

describe('moderation plugins', () => {
  test('a punishment names the player by UUID, its length in minutes or for good, and its reason', () => {
    expect(punishCommand({ kind: 'warn', playerUuid: uuid, minutes: 30, reason: 'Be kind' })).toBe(
      `libertybans warn ${uuid} Be kind`,
    )
    expect(punishCommand({ kind: 'mute', playerUuid: uuid, minutes: 59.2, reason: 'Spam\nagain' })).toBe(
      `libertybans mute ${uuid} 60m Spam again`,
    )
    expect(punishCommand({ kind: 'ban', playerUuid: uuid, minutes: null, reason: ' ' })).toBe(
      `libertybans ban ${uuid} perm`,
    )
    expect(liftCommand('mute', uuid)).toBe(`libertybans unmute ${uuid}`)
    expect(liftCommand('ban', uuid)).toBe(`libertybans unban ${uuid}`)
    expect(helperCommand(uuid, true)).toBe(`lp user ${uuid} parent add helper`)
    // LibertyBans refuses a second ban while one stands: the standing one goes first.
    expect(giveCommands({ kind: 'ban', playerUuid: uuid, minutes: 60, reason: '' })).toEqual([
      `libertybans unban ${uuid}`,
      `libertybans ban ${uuid} 60m`,
    ])
  })

  test('no command for an address is offered, and nobody may punish one', () => {
    const files = moderationFiles(CHAT_FILTER)
    const text = (path: string) => files.find((file) => file.path === path)?.content ?? ''
    const config = text('plugins/LibertyBans/config.yml')
    expect(config).toContain('address-strictness: LENIENT')
    expect(config).toContain('should-register-on-connection: false')
    const aliases = config.slice(config.indexOf('aliases:'))
    expect(aliases).not.toMatch(/ip|alts/)
    const denied = text('plugins/LuckPerms/yaml-storage/groups/default.yml')
    for (const kind of ['ban', 'mute', 'warn', 'kick'])
      expect(denied).toContain(`- libertybans.${kind}.do.target.ip:\n    value: false`)
    expect(text('plugins/LuckPerms/yaml-storage/groups/helper.yml')).not.toMatch(/target\.(ip|both)/)
  })

  test('the chat filter blocks rather than rewrites, and comes only where it is on', () => {
    expect(moderationFiles(null).map((file) => file.path)).not.toContain('plugins/ChatSentinel/config.yml')
    const filter = moderationFiles(CHAT_FILTER).find(
      (file) => file.path === 'plugins/ChatSentinel/config.yml',
    )
    expect(filter?.content).toContain(
      '    - "libertybans mute %player% 1h Kept writing what the chat filter blocks"',
    )
    // Each module ChatSentinel would rewrite a message with is off.
    for (const module of ['correction', 'capitalization', 'social-spy', 'no-move-chat', 'syntax'])
      expect(filter?.content).toMatch(new RegExp(`^${module}:\\n(?:[ #].*\\n|\\n)*?  enabled: false`, 'm'))
    expect(filter?.content).toMatch(/^flood:\n(?:[ #].*\n|\n)*? {2}replace: false/m)
  })
})
