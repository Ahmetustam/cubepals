// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The moderation plugins' console commands on a fake Paper server, as the real ones behave
 * (measured on Paper 1.21.11, LibertyBans 1.1.4 and LuckPerms 5.5.71): `libertybans` answers
 * nothing over RCON, its reply going out later; `lp user <uuid> parent add|remove <group>` writes
 * the user's file under `yaml-storage/users/`, which the real one does a moment later. It knows
 * these as the plugins would, not through Blockly's own code for them.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const USERS = 'plugins/LuckPerms/yaml-storage/users'

/**
 * A command the game doesn't know, answered by the plugin it names where the server runs one (it
 * keeps its settings there), and by the game's refusal where not.
 */
export async function plugin(dir: string, verb: string, args: string[]): Promise<string> {
  const folder = verb === 'libertybans' ? 'LibertyBans' : verb === 'lp' ? 'LuckPerms' : null
  const runs =
    folder !== null &&
    (await readFile(join(dir, 'plugins', folder, 'config.yml')).then(
      () => true,
      () => false,
    ))
  if (!runs) return 'Unknown or incomplete command, see below for error'
  return verb === 'lp' ? luckPerms(dir, args) : ''
}

/** LuckPerms' `lp user <uuid> parent add|remove <group>`; anything else it is asked answers nothing. */
async function luckPerms(dir: string, args: string[]): Promise<string> {
  const [user, uuid = '', parent, action, group = ''] = args
  if (user !== 'user' || parent !== 'parent' || (action !== 'add' && action !== 'remove')) return ''
  const file = join(dir, USERS, `${uuid}.yml`)
  const before = await readFile(file, 'utf8').catch(
    () => `uuid: ${uuid}\nname: 'null'\nprimary-group: default\nparents:\n- default\n`,
  )
  const parents = before
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2))
    .filter((name) => name !== group)
  if (action === 'add') parents.push(group)
  const head = before.slice(0, before.indexOf('parents:'))
  await mkdir(join(dir, USERS), { recursive: true })
  await writeFile(file, `${head}parents:\n${parents.map((name) => `- ${name}\n`).join('')}`)
  return ''
}
