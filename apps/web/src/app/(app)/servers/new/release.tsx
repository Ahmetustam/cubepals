// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

'use client'

/**
 * The Minecraft release in the create page's bar, for a template: a pick among the releases
 * Cubepals offers, where the ones the template doesn't run on can't be picked and say why. The
 * answer is the control plane's (`servers.setupReleases`), the same creating would give; this only
 * draws it. What picking one does is the page's.
 */
import type { CreateOptions } from '@blockly/contracts'
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '../../../../lib/api'
import styles from './create.module.css'

export function ReleasePick({
  template,
  title,
  value,
  offered,
  onPick,
}: {
  /** The template's key, and its name for saying a release isn't for it. */
  template: string
  title: string | undefined
  value: string
  offered: CreateOptions['gameVersions']
  onPick: (gameVersion: string) => void
}) {
  const trpc = useTRPC()
  const releases = useQuery(trpc.servers.setupReleases.queryOptions({ key: template }))
  const runs = new Map((releases.data ?? []).map((one) => [one.gameVersion, one]))
  return (
    <select
      className={styles.barVersion}
      aria-label="Minecraft version"
      value={value}
      onChange={(event) => onPick(event.target.value)}
    >
      {offered.map((release) => {
        const fit = runs.get(release.value)
        return (
          <option
            key={release.value}
            value={release.value}
            disabled={fit?.runs === false}
            title={fit?.reason}
          >
            Minecraft {release.label}
            {fit?.runs === false ? ` · not for ${title ?? 'this'}` : ''}
          </option>
        )
      })}
    </select>
  )
}
