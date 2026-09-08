import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authUrl, googleConfigured, makePkce, redirectUri, txCookie } from '../../../server/google.js'

/** Kicks off Google sign-in: stashes a PKCE verifier + state in a short-lived
 * cookie and 302s to Google's consent screen. */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!googleConfigured()) {
    res.status(503).json({ error: 'Google sign-in is not configured on this deployment.' })
    return
  }
  const { verifier, challenge, state } = makePkce()
  res.setHeader('Set-Cookie', txCookie(`${state}.${verifier}`))
  res.setHeader('Cache-Control', 'no-store')
  res.redirect(302, authUrl({ redirectUri: redirectUri(req.headers), state, challenge }))
}
