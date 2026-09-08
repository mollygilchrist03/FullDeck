import type { VercelRequest, VercelResponse } from '@vercel/node'
import { HANDLERS } from '../../server/authRoutes.js'

/**
 * Single serverless entry point for every `/api/auth/*` route except the two
 * Google OAuth endpoints (they sit a segment deeper). Dispatches by the final
 * path segment so the whole auth surface costs one function, not nine.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query.action
  const action = Array.isArray(raw) ? raw[0] : (raw ?? '')
  const fn = HANDLERS[action]
  if (!fn) {
    res.status(404).json({ error: 'Unknown endpoint.' })
    return
  }
  await fn(req, res)
}
