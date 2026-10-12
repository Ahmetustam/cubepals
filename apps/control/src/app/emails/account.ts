// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The emails about a person's account: the welcome once it is ready, the link that confirms its
 * email, a reset link, and the notice that its password changed. Sign-in sends them
 * (infra/auth/better-auth.ts, given these by main.node.ts), from the account sender. All but the
 * welcome are `plain`, so they reach the inbox rather than Promotions.
 */
import { ACCOUNT, type Email, layout, link, p, plain } from '../emails.ts'

/** Once, when an account is ready: its email confirmed, or made through Google or GitHub. */
export function welcome(origin: string): Email {
  const url = `${origin}/servers/new`
  const preheader = 'Make a server, then send your friends its address.'
  const lines = [
    'Your account is ready. Make a server, choose what to play, and send your friends its address.',
    'It sleeps when nobody’s on and wakes when someone joins, so your hours only go to playing.',
  ]
  return {
    subject: 'Welcome to Cubepals',
    preheader,
    text: [...lines, `Make a server: ${url}`].join('\n\n'),
    html: layout({
      origin,
      preheader,
      figure: { name: 'moss-waving' },
      heading: 'Welcome to Cubepals',
      body: lines.map(p).join(''),
      action: { label: 'Make a server', url },
      why: ACCOUNT,
    }),
  }
}

export function verifyEmail(url: string): Email {
  const subject = 'Confirm your email for Cubepals'
  return {
    subject,
    text: `Confirm your email to start creating servers:\n\n${url}\n\nIf you did not sign up, ignore this email.`,
    html: plain({
      subject,
      body:
        p(`${link({ label: 'Confirm your email', url })} to start creating servers.`) +
        p('If you did not sign up, ignore this email.'),
      why: 'You get this because someone signed up to Cubepals with this address.',
    }),
  }
}

export function resetPassword(url: string): Email {
  const subject = 'Reset your Cubepals password'
  return {
    subject,
    text: `Someone asked to reset the password for your Cubepals account. Choose a new one here:\n\n${url}\n\nThe link works for an hour, once. If it was not you, ignore this email: your password stays as it is.`,
    html: plain({
      subject,
      body:
        p(
          `Someone asked to reset the password for your Cubepals account. ${link({ label: 'Choose a new one here', url })}.`,
        ) +
        p(
          'The link works for an hour, once. If it was not you, ignore this email: your password stays as it is.',
        ),
      why: ACCOUNT,
    }),
  }
}

export function passwordChanged(origin: string): Email {
  const url = `${origin}/forgot-password`
  const subject = 'Your Cubepals password was changed'
  return {
    subject,
    text: `The password for your Cubepals account was just changed, and every device was signed out.\n\nIf that was not you, reset it again now:\n\n${url}`,
    html: plain({
      subject,
      body:
        p('The password for your Cubepals account was just changed, and every device was signed out.') +
        p(`If that was not you, ${link({ label: 'reset it again now', url })}.`),
      why: ACCOUNT,
    }),
  }
}
