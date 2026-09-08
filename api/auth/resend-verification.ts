import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb, isDbConfigured } from '../../db/client.js'
import {
  clientIp,
  createEmailToken,
  loginThrottled,
  originLooksForeign,
  sessionUser,
} from '../../server/auth.js'
import { originOf, sendMail } from '../../server/mail.js'

const VERIFY_TTL_MS = 24 * 3600_000

/** Re-send the confirmation email to the signed-in, still-unverified account. */
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

  try {
    const db = getDb()
    if (await loginThrottled(db, clientIp(req.headers, req.socket?.remoteAddress ?? 'unknown'))) {
      res.status(429).json({ error: 'Too many attempts — try again in a bit.' })
      return
    }
    const me = await sessionUser(db, req.headers.cookie)
    if (!me) {
      res.status(401).json({ error: 'Sign in first.' })
      return
    }
    if (me.emailVerified) {
      res.status(200).json({ ok: true, alreadyVerified: true })
      return
    }

    const token = await createEmailToken(db, me.id, 'verify', VERIFY_TTL_MS)
    const link = `${originOf(req.headers)}/account/verify?token=${token}`
    await sendMail(
      me.email,
      'Confirm your Full Deck email',
      `Confirm this address:\n${link}\n\nThe link is good for 24 hours.`,
    )
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[api/auth/resend-verification]', err)
    res.status(500).json({ error: 'Could not send the email.' })
  }
}
