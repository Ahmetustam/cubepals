// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Sign-up as one person's one set of free hours, through the real Better Auth and the real
 * control plane: a throwaway address is refused with nothing written; one address refuses
 * nobody, and is kept, by its network, only as a weak signal; aliases of one inbox share one set of
 * free hours; and Turnstile's answer is checked by Cloudflare itself, with the keys Cloudflare
 * publishes for testing.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { DISPOSABLE_EMAIL, TERMS_VERSION } from '@blockly/contracts'
import { schema } from '@blockly/db'
import { eq, inArray } from 'drizzle-orm'
import { ensureStanding } from '../../app/accounts/persistence.ts'
import { type Harness, hasDatabase, startHarness } from '../../testing/harness.ts'
import { authMail } from '../../testing/outbox.ts'
import { type AuthOptions, authHandler, createAuth } from './better-auth.ts'

const ORIGIN = 'https://blockly.test'
const API = 'http://api.internal:4000'
const ADDRESS_HEADER = 'x-blockly-client-address'

/**
 * Cloudflare's own Turnstile test keys: a secret that passes every answer, one that fails every
 * answer, and the answer its test site keys give (developers.cloudflare.com/turnstile/troubleshooting/testing).
 */
const TURNSTILE_TEST = {
  passes: '1x0000000000000000000000000000000AA',
  fails: '2x0000000000000000000000000000000AA',
  answer: 'XXXX.DUMMY.TOKEN.XXXX',
}

let h: Harness

const auth = (extra: Partial<AuthOptions> = {}) =>
  authHandler(
    createAuth({
      clientAddressHeader: ADDRESS_HEADER,
      db: h.db,
      ...authMail(),
      canonicalOrigin: ORIGIN,
      trustedOrigins: [],
      secret: 'a-test-secret-that-is-long-enough-for-better-auth',
      cookiePrefix: 'blockly-test',
      github: null,
      google: null,
      oauthProxy: null,
      onAccountCreated: (userId) => ensureStanding(h.db, userId),
      onSignedUp: (userId, key, address) => h.app.accounts.freePlay.signedUp(userId, key, address),
      ...extra,
    }),
  )

const signUp = (
  handle: (request: Request) => Promise<Response>,
  email: string,
  headers: Record<string, string> = {},
) =>
  handle(
    new Request(`${API}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers },
      body: JSON.stringify({
        email,
        password: 'a-long-enough-password',
        name: '',
        agreement: { terms: TERMS_VERSION },
      }),
    }),
  )
const accountOf = async (email: string) =>
  (await h.db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)))[0]
    ?.id ?? null
const someone = () => `p-${randomUUID().slice(0, 8)}@example.test`

beforeAll(async () => {
  if (hasDatabase) h = await startHarness()
}, 30_000)
afterAll(async () => {
  if (hasDatabase) await h.close()
})

describe.skipIf(!hasDatabase)('signing up for free hours', () => {
  test('a throwaway address is refused, saying why, with nothing written', async () => {
    const handle = auth()
    const email = `p-${randomUUID().slice(0, 8)}@mailinator.com`
    const refused = await signUp(handle, email, { [ADDRESS_HEADER]: '198.51.100.1' })
    expect(refused.status).toBe(403)
    expect(await refused.json()).toMatchObject({
      code: DISPOSABLE_EMAIL,
      message: 'That’s a throwaway email address. Sign up with one you keep, so you can always get back in.',
    })
    expect(await accountOf(email)).toBeNull()
  })

  test('one address refuses nobody, and keeps only its network, as a weak signal', async () => {
    const handle = auth()
    // A school, a phone network or a household: one address, many people.
    const emails = Array.from({ length: 8 }, someone)
    for (const [i, email] of emails.entries())
      expect((await signUp(handle, email, { [ADDRESS_HEADER]: `2001:db8:5:6::${i + 1}` })).status).toBe(200)
    const ids = await Promise.all(emails.map(accountOf))
    const rows = await h.db
      .select()
      .from(schema.freePlay)
      .where(
        inArray(
          schema.freePlay.userId,
          ids.filter((id) => id !== null),
        ),
      )
    expect(rows.map((row) => row.signupNetwork)).toEqual(emails.map(() => '2001:db8:5:6::/64'))
    expect(rows.every((row) => row.groupId === null)).toBe(true)
    expect(
      await h.db
        .select()
        .from(schema.freeLinks)
        .where(
          inArray(
            schema.freeLinks.accountId,
            ids.filter((id) => id !== null),
          ),
        ),
    ).toEqual([])
    // A sign-up nobody could place goes on too.
    expect((await signUp(handle, someone())).status).toBe(200)
  })

  test('aliases of one inbox are one person’s free hours', async () => {
    const handle = auth()
    const inbox = `s.teve${randomUUID().slice(0, 6)}`
    expect((await signUp(handle, `${inbox}@gmail.com`)).status).toBe(200)
    expect((await signUp(handle, `${inbox.replace('.', '')}+farm@googlemail.com`)).status).toBe(200)
    const first = await accountOf(`${inbox}@gmail.com`)
    const second = await accountOf(`${inbox.replace('.', '')}+farm@googlemail.com`)
    if (first === null || second === null) throw new Error('both accounts exist')
    const [link] = await h.db.select().from(schema.freeLinks).where(eq(schema.freeLinks.accountId, second))
    expect(link).toMatchObject({ linkedId: first, score: 1, signals: { inbox: 1 } })
    const [row] = await h.db.select().from(schema.freePlay).where(eq(schema.freePlay.userId, second))
    expect(row?.emailKey).toBe(`${inbox.replace('.', '')}@gmail.com`)
  })

  test('with Turnstile on, Cloudflare checks the form’s answer before any account is made', async () => {
    const passing = auth({ turnstile: { secretKey: TURNSTILE_TEST.passes } })
    const unanswered = someone()
    const missing = await signUp(passing, unanswered)
    expect(missing.status).toBe(400)
    expect(await missing.json()).toMatchObject({ code: 'MISSING_RESPONSE' })
    expect(await accountOf(unanswered)).toBeNull()
    expect((await signUp(passing, someone(), { 'x-captcha-response': TURNSTILE_TEST.answer })).status).toBe(
      200,
    )

    const failing = auth({ turnstile: { secretKey: TURNSTILE_TEST.fails } })
    const bot = someone()
    const refused = await signUp(failing, bot, { 'x-captcha-response': TURNSTILE_TEST.answer })
    expect(refused.status).toBe(403)
    expect(await refused.json()).toMatchObject({ code: 'VERIFICATION_FAILED' })
    expect(await accountOf(bot)).toBeNull()
  }, 30_000)
})
