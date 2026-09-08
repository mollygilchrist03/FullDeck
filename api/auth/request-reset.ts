import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { getDb, isDbConfigured } from '../../db/client.js'
import { users } from '../../db/schema.js'
import { isValidEmail, normalizeEmail } from '../../src/lib/auth.js'
import {
  clientIp,
  createEmailToken,
  loginThrottled,
  originLooksForeign,
} from '../../server/auth.js'
import { originOf, sendMail } from '../../server/mail.js'

const RESET_TTL_MS = 60 * 60_000 // 1 hour

/** Start a password reset. Always answers the same way — no way to probe
 * which addresses have accounts. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isDbConfigured) {
    res.status(503).json({ error: 'Accounts are not configured on this deployment.' })
    return
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed.' })
    return
  }
  if (originLooksForeign(req.headers)) {
    res.status(403).json({ error: 'Request rejected.' })
    return
  }

  const done = () =>
    res.status(200).json({ ok: true, message: 'If that email has an account, a reset link is on its way.' })

  try {
    const db = getDb()
    if (await loginThrottled(db, clientIp(req.headers, req.socket?.remoteAddress ?? 'unknown'))) {
      res.status(429).json({ error: 'Too many attempts — try again in a bit.' })
      return
    }

    const email = normalizeEmail(String((req.body as Record<string, unknown>)?.email ?? ''))
    if (!isValidEmail(email)) {
      done()
      return
    }
    const [row] = await db
      .select({ id: users.id, hasPassword: users.passwordHash })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    // Only send to accounts that actually have a password to reset.
    if (row && row.hasPassword) {
      try {
        const token = await createEmailToken(db, row.id, 'reset', RESET_TTL_MS)
        const link = `${originOf(req.headers)}/account/reset?token=${token}`
        await sendMail(
          email,
          'Reset your Full Deck password',
          `Someone asked to reset the password for this Full Deck account.\n\nSet a new one:\n${link}\n\nThe link is good for 1 hour. If it wasn't you, ignore this — nothing has changed.`,
        )
      } catch (mailErr) {
        console.error('[api/auth/request-reset] mail failed', mailErr)
      }
    }
    done()
  } catch (err) {
    console.error('[api/auth/request-reset]', err)
    done() // still don't leak anything
  }
}
