import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb, isDbConfigured } from '../../db/client.js'
import { publicUser, sessionUser } from '../../server/auth.js'
import { googleConfigured } from '../../server/google.js'

/** Who is signed in on this request, if anyone. Always 200 — `user` is null
 * when there's no valid session. `googleEnabled` tells the UI whether to
 * render the "Sign in with Google" button. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const googleEnabled = googleConfigured()
  if (!isDbConfigured) {
    res.status(200).json({ user: null, configured: false, googleEnabled })
    return
  }
  try {
    const row = await sessionUser(getDb(), req.headers.cookie)
    res.status(200).json({ user: row ? publicUser(row) : null, configured: true, googleEnabled })
  } catch (err) {
    console.error('[api/auth/me]', err)
    res.status(200).json({ user: null, configured: true, googleEnabled })
  }
}
