// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * A commit subject or pull request title says the change in 50 characters or fewer, so GitHub
 * shows it whole in the file list and the history. Pull requests are squash-merged, so the title
 * becomes the subject on main.
 *
 *   bun run scripts/check-subject.ts <message file>   lefthook's commit-msg hook
 *   bun run scripts/check-subject.ts --title          CI, with the title in PR_TITLE
 *
 * Subjects git or a tool writes pass as they are: merges, reverts, fixup!, squash! and amend!
 * commits, and commits by a bot. The ` (#123)` GitHub adds when it squashes isn't counted.
 *
 * It judges only the subject's shape, not whether it says the change well.
 */
import { readFileSync } from 'node:fs'

export const MAX_SUBJECT = 50
const WRITTEN_BY_GIT = /^(Merge |Revert "|fixup! |squash! |amend! )/
const SQUASH_NUMBER = / \(#\d+\)$/

/** What is wrong with a subject, or null when it passes. */
export function subjectProblem(subject: string): string | null {
  const text = subject.trimEnd().replace(SQUASH_NUMBER, '')
  if (WRITTEN_BY_GIT.test(text)) return null
  if (text.trim() === '') return 'The subject is empty. Say the change in one line.'
  const length = [...text].length
  if (length > MAX_SUBJECT) {
    return `The subject is ${length} characters; keep it to ${MAX_SUBJECT}. Say the change and put the detail in the body.`
  }
  if (text.endsWith('.')) return 'The subject ends with a period. Drop it.'
  return null
}

/** A commit message's subject: its first line that isn't blank or a comment git strips. */
export function subjectOf(message: string): string {
  return message.split('\n').find((line) => line.trim() !== '' && !line.startsWith('#')) ?? ''
}

function byBot(): boolean {
  const author = Bun.spawnSync(['git', 'var', 'GIT_AUTHOR_IDENT'], { stderr: 'ignore' })
  return author.stdout.toString().includes('[bot]')
}

if (import.meta.main) {
  const [arg] = process.argv.slice(2)
  if (!arg) {
    console.error('usage: check-subject.ts <message file> | --title')
    process.exit(2)
  }
  const title = arg === '--title'
  const subject = title ? (process.env.PR_TITLE ?? '') : subjectOf(readFileSync(arg, 'utf8'))
  const problem = title || !byBot() ? subjectProblem(subject) : null
  if (problem) {
    console.error(`${title ? 'Pull request title' : 'Commit subject'}: ${subject.trim() || '(empty)'}`)
    console.error(problem)
    process.exit(1)
  }
}
