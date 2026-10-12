// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The email with a gift's code, to whoever bought it (`Gifts.issue`): the only place the code is
 * ever written, since only its hash is kept. `plain`, like any email about a payment: it must
 * reach the inbox.
 */
import { planName } from '../../domain/account/entitlements.ts'
import { ACCOUNT, type Email, esc, INK, link, MONO, p, plain } from '../emails.ts'

/** "a month of Plus", "12 months of Plus". */
const giftName = (planKey: string, months: number): string =>
  `${months === 1 ? 'a month' : `${months} months`} of ${planName(planKey)}`

export function giftCode(input: { code: string; planKey: string; months: number; origin: string }): Email {
  const redeem = `${input.origin}/redeem?code=${encodeURIComponent(input.code)}`
  const what = giftName(input.planKey, input.months)
  const lines = [
    `Here’s your gift: ${what}. Pass the code on to whoever it’s for.`,
    'They redeem it on Cubepals, signed in to their own account, and it starts then. It works once, and it doesn’t run out.',
    'Not given it yet and changed your mind? Reply within 14 days of buying it for a full refund.',
  ]
  const subject = `Your Cubepals gift code: ${what}`
  return {
    subject,
    text: [lines[0], '', input.code, '', ...lines.slice(1), '', redeem].join('\n'),
    html: plain({
      subject,
      body:
        p(esc(lines[0] ?? '')) +
        `<p style="margin:0 0 16px;font:700 20px/1.4 ${MONO};letter-spacing:.04em;color:${INK}">${esc(input.code)}</p>` +
        lines
          .slice(1)
          .map((line) => p(esc(line)))
          .join('') +
        p(link({ label: 'The page to redeem it', url: redeem })),
      why: ACCOUNT,
    }),
  }
}
