import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb, isDbConfigured } from '../../db/client.js'
import { clearSessionCookie, destroySession, originLooksForeign } from '../../server/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    if (isDbConfigured) await destroySession(getDb(), req.headers.cookie)
  } catch (err) {
    console.error('[api/auth/logout]', err)
  }
  // Always clear the cookie and report success — logging out shouldn't fail.
  res.setHeader('Set-Cookie', clearSessionCookie())
  res.status(200).json({ ok: true })
}
