// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

'use client'

/**
 * A player's warnings, mutes and bans, on their own page: the next step the server's escalation
 * picks for them, ready to give with a reason or to swap for another, and what they were given from
 * Cubepals before, with a way to take back a mute or ban. Shown where the moderation tools run.
 */
import {
  MODERATION_LENGTHS,
  type ModerationActionView,
  type ModerationStep,
  nextStep,
  type PlayerView,
} from '@blockly/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { messageOf, useTRPC } from '../../../../../../lib/api'
import { stepLabel } from '../../../../../../lib/moderation'
import { said, useOutcome } from '../../../../../../lib/outcome'
import { timeAgo } from '../../../../../../lib/present'
import { Button, FormSection, Note, Select, TextField } from '../../../../../../ui'

const keyOf = (step: ModerationStep) => `${step.kind}:${step.minutes}`
const stepOf = (key: string): ModerationStep => {
  const [kind, minutes] = key.split(':')
  return {
    kind: kind as ModerationStep['kind'],
    minutes: minutes === 'null' || minutes === undefined ? null : Number(minutes),
  }
}

/** Every step there is to give, the warning first, then each mute and each ban from shortest. */
const CHOICES: ModerationStep[] = [
  { kind: 'warn', minutes: null },
  ...MODERATION_LENGTHS.map((minutes) => ({ kind: 'mute' as const, minutes })),
  ...MODERATION_LENGTHS.map((minutes) => ({ kind: 'ban' as const, minutes })),
]

export function PlayerModeration({
  serverId,
  player,
  running,
}: {
  serverId: string
  player: PlayerView
  running: boolean
}) {
  const trpc = useTRPC()
  const view = useQuery(trpc.moderation.get.queryOptions({ serverId }))
  if (!view.isSuccess || !view.data.enabled) return null
  const history = view.data.actions.filter((a) => a.player.uuid === player.uuid)
  const next = nextStep(view.data.ladder, history)
  return (
    <FormSection
      title="Moderation"
      description={
        history.length === 0
          ? `${player.name} hasn’t been warned, muted or banned here.`
          : `Next, the server’s steps give ${player.name}: ${stepLabel(next).toLowerCase()}.`
      }
    >
      {/* The form starts again on the new next step once something is given. */}
      <Give key={keyOf(next)} serverId={serverId} player={player} next={next} running={running} />
      {history.length > 0 && <History serverId={serverId} history={history} running={running} />}
    </FormSection>
  )
}

function Give({
  serverId,
  player,
  next,
  running,
}: {
  serverId: string
  player: PlayerView
  next: ModerationStep
  running: boolean
}) {
  const trpc = useTRPC()
  const queries = useQueryClient()
  const [choice, setChoice] = useState(keyOf(next))
  const [reason, setReason] = useState('')
  const outcome = useOutcome(undefined)
  const give = useMutation(
    trpc.moderation.punish.mutationOptions({
      onSuccess: () => {
        setReason('')
        outcome.settled()
        void queries.invalidateQueries({ queryKey: trpc.moderation.get.queryKey({ serverId }) })
      },
      onError: () => outcome.refused(),
    }),
  )
  const step = stepOf(choice)
  return (
    <div className="bk-stack" style={{ gap: 'var(--space-12)' }}>
      <Select
        label="Give"
        value={choice}
        options={CHOICES.map((c) => ({
          value: keyOf(c),
          label: keyOf(c) === keyOf(next) ? `${stepLabel(c)} (next step)` : stepLabel(c),
        }))}
        onChange={(event) => setChoice(event.target.value)}
      />
      <TextField
        label="Reason"
        optional
        maxLength={120}
        value={reason}
        placeholder="What they did"
        help={`${player.name} sees it${step.kind === 'ban' ? ' when they try to join' : ''}.`}
        onChange={(event) => setReason(event.target.value)}
      />
      <div>
        <Button
          {...said(outcome, { done: 'Given', failed: 'Didn’t give it' })}
          disabled={give.isPending}
          onClick={() =>
            give.mutate({
              serverId,
              playerUuid: player.uuid,
              name: player.name,
              reason: reason.trim(),
              ...step,
            })
          }
        >
          {stepLabel(step)}
        </Button>
      </div>
      {!running && <p className="bk-field__help">It reaches the server when it next starts.</p>}
      {give.isError && <Note tone="danger">{messageOf(give.error)}</Note>}
    </div>
  )
}

function History({
  serverId,
  history,
  running,
}: {
  serverId: string
  history: ModerationActionView[]
  running: boolean
}) {
  const trpc = useTRPC()
  const queries = useQueryClient()
  const lift = useMutation(
    trpc.moderation.lift.mutationOptions({
      onSettled: () =>
        void queries.invalidateQueries({ queryKey: trpc.moderation.get.queryKey({ serverId }) }),
    }),
  )
  const now = Date.now()
  return (
    <div className="bk-stack" style={{ gap: 'var(--space-8)' }}>
      <h3 className="type-heading-sm" style={{ color: 'var(--ink)' }}>
        Given from Cubepals
      </h3>
      <ul className="bk-stack" style={{ gap: 'var(--space-8)', listStyle: 'none', padding: 0, margin: 0 }}>
        {history.map((action) => (
          <li key={action.id} className="bk-row" style={{ gap: 'var(--space-12)', flexWrap: 'wrap' }}>
            <div className="bk-stack" style={{ gap: 'var(--space-2)', flex: 1, minWidth: 0 }}>
              <span className="type-body-md" style={{ color: 'var(--ink)' }}>
                {stepLabel(action)}
                {action.reason ? ` · ${action.reason}` : ''}
              </span>
              <span
                className="type-body-sm"
                style={{ color: action.error ? 'var(--danger)' : 'var(--ink-muted)' }}
              >
                {statusLine(action, running, now)}
              </span>
            </div>
            {action.kind !== 'warn' && (action.status === 'given' || action.status === 'waiting') && (
              <Button
                variant="ghost"
                size="sm"
                disabled={lift.isPending}
                onClick={() => lift.mutate({ serverId, actionId: action.id })}
              >
                Take back
              </Button>
            )}
          </li>
        ))}
      </ul>
      <p className="bk-field__help">What helpers give in the game shows there, with /history.</p>
      {lift.isError && <Note tone="danger">{messageOf(lift.error)}</Note>}
    </div>
  )
}

/** When it was given, and where it stands now. */
function statusLine(action: ModerationActionView, running: boolean, now: number): string {
  const ago = timeAgo(action.at, now)
  const when = ago.charAt(0).toUpperCase() + ago.slice(1)
  if (action.error) return `${when} · Not given yet — ${action.error}`
  switch (action.status) {
    case 'waiting':
      return `${when} · ${running ? 'Giving…' : 'Given when the server starts'}`
    case 'given':
      return action.endsAt === null ? when : `${when} · Ends ${new Date(action.endsAt).toLocaleString()}`
    case 'over':
      return `${when} · Over`
    case 'lifting':
      return `${when} · ${running ? 'Taking back…' : 'Taken back when the server starts'}`
    case 'lifted':
      return `${when} · Taken back`
  }
}
