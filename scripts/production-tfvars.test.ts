// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The real config.auto.tfvars.json brought up to date with the committed example: on a stand-in
 * copy of the example, never an operator's own file.
 */
import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bringUpToDate, driftOf } from './production-tfvars.ts'
import { ENVIRONMENT_EXAMPLE } from './production-values.ts'

const example = JSON.parse(readFileSync(join(import.meta.dir, '..', ENVIRONMENT_EXAMPLE), 'utf8')) as {
  settings: Record<string, string>
  secret_names: string[]
  optional_secret_names: string[]
}
/** The operator's file as it was on 2026-10-11: copied before OPERATOR_TOKEN was a secret. */
const stale = {
  ...example,
  secret_names: example.secret_names.filter((name) => name !== 'OPERATOR_TOKEN'),
}

describe('the drift', () => {
  test('a file copied from the example has none', () => {
    expect(driftOf(example, example)).toEqual({ updated: example, added: [], differs: [] })
  })

  test("a secret's name the example gained is added", () => {
    const { updated, added, differs } = driftOf(stale, example)
    expect(added).toEqual(['secret_names: OPERATOR_TOKEN'])
    expect(updated.secret_names).toContain('OPERATOR_TOKEN')
    expect(differs).toEqual([])
  })

  test("an optional secret's name and a new setting are added, with the example's value", () => {
    const real = { ...example, optional_secret_names: example.optional_secret_names.slice(1) }
    const withNew = { ...example, settings: { ...example.settings, BRAND_NEW: 'from-the-example' } }
    const { updated, added } = driftOf(real, withNew)
    expect(added).toEqual([
      `optional_secret_names: ${example.optional_secret_names[0]}`,
      'settings.BRAND_NEW',
    ])
    expect((updated.settings as Record<string, string>).BRAND_NEW).toBe('from-the-example')
    expect(updated.optional_secret_names).toEqual(expect.arrayContaining(example.optional_secret_names))
  })

  test("the operator's own choices are named and kept, never their values", () => {
    const real = {
      ...example,
      fly_machine_limit: 40,
      settings: { ...example.settings, ARCHIVE_S3_BUCKET: 'operator-chosen-bucket', OLD_ONE: 'x' },
      secret_names: [...example.secret_names, 'RETIRED_SECRET'],
    }
    const { updated, added, differs } = driftOf(real, example)
    expect(added).toEqual([])
    expect(updated).toEqual(real)
    expect(differs).toEqual([
      "secret_names has RETIRED_SECRET, which the example doesn't",
      'settings.ARCHIVE_S3_BUCKET',
      "settings.OLD_ONE isn't in the example",
      'fly_machine_limit',
    ])
    expect(differs.join('\n')).not.toContain('operator-chosen-bucket')
  })
})

describe('the file', () => {
  test('is written only when something was added, and says only names', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tfvars-'))
    try {
      const file = join(dir, 'config.auto.tfvars.json')
      const committed = join(dir, 'config.auto.tfvars.example.json')
      writeFileSync(committed, JSON.stringify(example))
      writeFileSync(
        file,
        JSON.stringify({ ...stale, settings: { ...stale.settings, MAIL_FROM: 'Mine <me@x>' } }),
      )
      const said: string[] = []
      bringUpToDate(file, committed, (line) => said.push(line))
      const written = JSON.parse(readFileSync(file, 'utf8'))
      expect(written.secret_names).toContain('OPERATOR_TOKEN')
      expect(written.settings.MAIL_FROM).toBe('Mine <me@x>')
      expect(said.join('\n')).toContain('secret_names: OPERATOR_TOKEN')
      expect(said.join('\n')).toContain('settings.MAIL_FROM')
      expect(said.join('\n')).not.toContain('me@x')

      const before = statSync(file).mtimeMs
      said.length = 0
      bringUpToDate(file, committed, (line) => said.push(line))
      expect(said.join('\n')).not.toContain('Added')
      expect(statSync(file).mtimeMs).toBe(before)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
