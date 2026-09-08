import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb, isDbConfigured } from '../../db/client.js'
import { publicUser, sessionUser } from '../../server/auth.js'

/** Who is signed in on this request, if anyone. Always 200 — `user` is null
 * when there's no valid session. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!isDbConfigured) {
    res.status(200).json({ user: null, configured: false })
    return
  }
  try {
    const row = await sessionUser(getDb(), req.headers.cookie)
    res.status(200).json({ user: row ? publicUser(row) : null, configured: true })
  } catch (err) {
    console.error('[api/auth/me]', err)
    res.status(200).json({ user: null, configured: true })
  }
}
