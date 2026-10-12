// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * check-subject.ts's rule at its edges (50 characters, the exemptions), and the script as the
 * commit-msg hook and CI run it.
 */
import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { MAX_SUBJECT, subjectOf, subjectProblem } from './check-subject.ts'

const SCRIPT = resolve(import.meta.dir, 'check-subject.ts')

function run(args: string[], env: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'check-subject-'))
  try {
    const result = Bun.spawnSync(['bun', SCRIPT, ...args], {
      cwd: dir,
      env: { ...process.env, ...env },
      stderr: 'pipe',
    })
    return { code: result.exitCode, stderr: result.stderr.toString() }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('subjectProblem', () => {
  test('passes a subject at the limit and refuses one past it', () => {
    expect(subjectProblem('a'.repeat(MAX_SUBJECT))).toBeNull()
    expect(subjectProblem('a'.repeat(MAX_SUBJECT + 1))).toContain('51 characters')
  })

  test('counts characters, not bytes', () => {
    expect(subjectProblem('é'.repeat(MAX_SUBJECT))).toBeNull()
    expect(subjectProblem(`Tell zod’s messages apart ${'—'.repeat(24)}`)).toBeNull()
  })

  test('refuses an empty subject and a trailing period', () => {
    expect(subjectProblem('')).toContain('empty')
    expect(subjectProblem('   ')).toContain('empty')
    expect(subjectProblem('Start the server on wake.')).toContain('period')
  })

  test('ignores trailing spaces and the number GitHub adds when it squashes', () => {
    expect(subjectProblem(`${'a'.repeat(MAX_SUBJECT)}  `)).toBeNull()
    expect(subjectProblem(`${'a'.repeat(MAX_SUBJECT)} (#134)`)).toBeNull()
    expect(subjectProblem(`${'a'.repeat(MAX_SUBJECT + 1)} (#134)`)).not.toBeNull()
  })

  test('passes a Move: title that fits', () => {
    expect(subjectProblem('Move: server pictures into pictures.ts')).toBeNull()
    expect(subjectProblem('Move: server pictures out of present.ts into pictures.ts')).not.toBeNull()
  })

  test('passes what git writes, however long', () => {
    const long = 'x'.repeat(80)
    expect(subjectProblem(`Merge branch 'main' into claude/${long}`)).toBeNull()
    expect(subjectProblem(`Revert "${long}"`)).toBeNull()
    expect(subjectProblem(`fixup! ${long}`)).toBeNull()
    expect(subjectProblem(`squash! ${long}`)).toBeNull()
    expect(subjectProblem(`amend! ${long}`)).toBeNull()
  })
})

describe('subjectOf', () => {
  test('takes the first line that is not blank or a comment', () => {
    expect(subjectOf('\n# Please enter the commit message\n\nSay the change\n\nWhy.\n')).toBe(
      'Say the change',
    )
    expect(subjectOf('# only comments\n')).toBe('')
  })
})

describe('the script', () => {
  test('checks a message file, as the commit-msg hook runs it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'check-subject-msg-'))
    try {
      const good = join(dir, 'good')
      const bad = join(dir, 'bad')
      writeFileSync(good, 'Say the change\n\nThe detail goes here, as long as it needs.\n')
      writeFileSync(bad, `${'a'.repeat(MAX_SUBJECT + 1)}\n`)
      const author = { GIT_AUTHOR_NAME: 'Someone', GIT_AUTHOR_EMAIL: 'someone@example.com' }
      expect(run([good], author).code).toBe(0)
      expect(run([bad], author).code).toBe(1)
      expect(
        run([bad], { GIT_AUTHOR_NAME: 'dependabot[bot]', GIT_AUTHOR_EMAIL: 'bot@example.com' }).code,
      ).toBe(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('checks the pull request title from PR_TITLE', () => {
    expect(run(['--title'], { PR_TITLE: 'Enforce short commit subjects' }).code).toBe(0)
    const refused = run(['--title'], { PR_TITLE: 'a'.repeat(MAX_SUBJECT + 1) })
    expect(refused.code).toBe(1)
    expect(refused.stderr).toContain('Pull request title')
    expect(run(['--title'], { PR_TITLE: '' }).code).toBe(1)
  })
})
