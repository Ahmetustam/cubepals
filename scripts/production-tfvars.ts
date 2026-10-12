// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * An environment's config.auto.tfvars.json kept up to date with the committed example it was copied
 * from. The real file is made once, so a name the example gains later (a secret in `secret_names`,
 * a new setting) would otherwise reach Terraform's preconditions as a stop. What is safe to add is
 * added: a secret's name, and a setting the real file lacks, with the example's value. What the
 * operator chose differently is named, never changed. Only names and keys are said, never a value.
 *
 * Not for checking the values themselves: production-values.ts and the control plane do that.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

type Tfvars = Record<string, unknown>

export interface Drift {
  /** The real file with what was safe to add added. */
  updated: Tfvars
  /** What was added, as `secret_names: OPERATOR_TOKEN` or `settings.NEW_SETTING`. */
  added: string[]
  /** Where the real file differs from the example, kept as the operator has it. */
  differs: string[]
}

const NAME_LISTS = ['secret_names', 'optional_secret_names'] as const

const names = (from: unknown): string[] => (Array.isArray(from) ? from.map(String) : [])
const isObject = (from: unknown): from is Record<string, unknown> =>
  typeof from === 'object' && from !== null && !Array.isArray(from)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** The real file against the example: names and settings added, every other difference named. */
export function driftOf(real: Tfvars, example: Tfvars): Drift {
  const drift: Drift = { updated: { ...real }, added: [], differs: [] }
  for (const list of NAME_LISTS) addNames(list, real, example, drift)
  addSettings(real, example, drift)
  nameTheRest(real, example, drift)
  return drift
}

/** A secret's name the example lists and the real file doesn't is added. */
function addNames(list: string, real: Tfvars, example: Tfvars, drift: Drift): void {
  const have = names(real[list])
  const wanted = names(example[list])
  const missing = wanted.filter((name) => !have.includes(name))
  if (missing.length > 0) {
    drift.updated[list] = [...have, ...missing]
    drift.added.push(`${list}: ${missing.join(', ')}`)
  }
  const extra = have.filter((name) => !wanted.includes(name))
  if (extra.length > 0) drift.differs.push(`${list} has ${extra.join(', ')}, which the example doesn't`)
}

/** A setting the real file lacks is added with the example's value; one set otherwise is named. */
function addSettings(real: Tfvars, example: Tfvars, drift: Drift): void {
  const settings = isObject(real.settings) ? real.settings : {}
  const wanted = isObject(example.settings) ? example.settings : {}
  const missing = Object.keys(wanted).filter((key) => !(key in settings))
  if (missing.length > 0) {
    drift.updated.settings = {
      ...settings,
      ...Object.fromEntries(missing.map((key) => [key, wanted[key]])),
    }
    drift.added.push(...missing.map((key) => `settings.${key}`))
  }
  for (const key of Object.keys(settings)) {
    if (!(key in wanted)) drift.differs.push(`settings.${key} isn't in the example`)
    else if (!same(settings[key], wanted[key])) drift.differs.push(`settings.${key}`)
  }
}

/** Everything else (the org, its machine limit, the website's) is the operator's: only named. */
function nameTheRest(real: Tfvars, example: Tfvars, drift: Drift): void {
  const managed: string[] = ['settings', ...NAME_LISTS]
  for (const key of new Set([...Object.keys(real), ...Object.keys(example)])) {
    if (managed.includes(key)) continue
    const mine = real[key]
    const theirs = example[key]
    if (isObject(mine) && isObject(theirs)) {
      for (const inner of new Set([...Object.keys(mine), ...Object.keys(theirs)]))
        if (!same(mine[inner], theirs[inner])) drift.differs.push(`${key}.${inner}`)
    } else if (!same(mine, theirs)) drift.differs.push(key)
  }
}

/**
 * Brings the real file up to date with the example, writing it only when something was added, and
 * says what it added and where the two still differ. Nothing happens when there is no real file.
 */
export function bringUpToDate(file: string, example: string, say: (line: string) => void): void {
  if (!existsSync(file) || !existsSync(example)) return
  const { updated, added, differs } = driftOf(
    JSON.parse(readFileSync(file, 'utf8')) as Tfvars,
    JSON.parse(readFileSync(example, 'utf8')) as Tfvars,
  )
  if (added.length > 0) {
    writeFileSync(file, `${JSON.stringify(updated, null, 2)}\n`)
    say(`Added to ${file} what ${example} gained since it was copied:`)
    for (const line of added) say(`  ${line}`)
  }
  if (differs.length > 0) {
    say(`Kept as ${file} has them, where the example differs:`)
    for (const line of differs) say(`  ${line}`)
  }
}
