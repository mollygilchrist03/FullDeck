import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, eq, isNull } from 'drizzle-orm'
import { getDb, isDbConfigured } from '../../../db/client.js'
import { users } from '../../../db/schema.js'
import { sanitizeName } from '../../../src/lib/leaderboard.js'
import { isCleanName } from '../../../src/lib/profanity.js'
import { createSession, sessionCookie } from '../../../server/auth.js'
import {
  clearTxCookie,
  exchangeCode,
  googleConfigured,
  readTxCookie,
  redirectUri,
} from '../../../server/google.js'

const fail = (res: VercelResponse) => {
  res.setHeader('Set-Cookie', clearTxCookie())
  res.redirect(302, '/account?error=google')
}

/** Fallback display name from an email local part, capped and de-profaned. */
function nameFrom(googleName: string, email: string): string {
  const cleaned = sanitizeName(googleName)
  if (cleaned && isCleanName(cleaned)) return cleaned
  const local = sanitizeName(email.split('@')[0]) || 'Player'
  return isCleanName(local) ? local : 'Player'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isDbConfigured || !googleConfigured()) {
    fail(res)
    return
  }

  try {
    const tx = readTxCookie(req.headers.cookie)
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    const state = typeof req.query.state === 'string' ? req.query.state : ''
    if (!tx || !code || !state || state !== tx.state) {
      fail(res)
      return
    }

    const identity = await exchangeCode({
      code,
      verifier: tx.verifier,
      redirectUri: redirectUri(req.headers),
    })

    const db = getDb()
    // 1) known Google account, 2) an existing email/password account to link,
    // 3) brand new.
    let [row] = await db.select().from(users).where(eq(users.googleSub, identity.sub)).limit(1)
    if (!row) {
      const [byEmail] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, identity.email), isNull(users.googleSub)))
        .limit(1)
      if (byEmail) {
        ;[row] = await db
          .update(users)
          .set({ googleSub: identity.sub })
          .where(eq(users.id, byEmail.id))
          .returning()
      }
    }
    if (!row) {
      ;[row] = await db
        .insert(users)
        .values({
          email: identity.email,
          googleSub: identity.sub,
          displayName: nameFrom(identity.name, identity.email),
        })
        .returning()
    }

    const token = await createSession(db, row.id)
    res.setHeader('Set-Cookie', [clearTxCookie(), sessionCookie(token)])
    // A redirect, not JSON — the client picks the new session up via
    // /api/auth/me when the /account page loads.
    res.redirect(302, '/account')
  } catch (err) {
    console.error('[api/auth/google/callback]', err)
    fail(res)
  }
}
