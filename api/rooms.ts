import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash, randomUUID } from 'node:crypto'
import { and, eq, gt, lt, sql } from 'drizzle-orm'
import { getDb, isDbConfigured } from '../db/client.js'
import { rooms, roomAttempts } from '../db/schema.js'
import { clampSeatCount, isMpGame, makeRoomCode, sanitizePlayerName, type Seat } from '../src/lib/multiplayer.js'

// Same salted-IP-hash rate-limit pattern as api/scores.ts (8 attempts /
// minute / IP, logged to a Postgres table rather than an in-memory Map so it
// holds across cold serverless instances) — room creation is the one op here
// that writes a fresh row, so it's the one worth gating.
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 8
const IP_SALT = process.env.IP_HASH_SALT ?? 'full-deck-rate-limit'
const CLEANUP_CHANCE = 0.02
const LOG_RETENTION_MS = 60 * 60_000

function hashIp(ip: string): string {
  return createHash('sha256').update(`${IP_SALT}:${ip}`).digest('hex')
}

function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string') return fwd.split(',')[0]!.trim()
  if (Array.isArray(fwd) && fwd[0]) return fwd[0]
  return req.socket?.remoteAddress ?? 'unknown'
}

/** Logs this attempt and reports whether the IP is already over the limit. */
async function checkRateLimit(ip: string): Promise<boolean> {
  const db = getDb()
  const ipHash = hashIp(ip)
  const since = new Date(Date.now() - RATE_WINDOW_MS)

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(roomAttempts)
    .where(and(eq(roomAttempts.ipHash, ipHash), gt(roomAttempts.createdAt, since)))

  await db.insert(roomAttempts).values({ ipHash })

  if (Math.random() < CLEANUP_CHANCE) {
    void db
      .delete(roomAttempts)
      .where(lt(roomAttempts.createdAt, new Date(Date.now() - LOG_RETENTION_MS)))
      .catch(() => {})
  }

  return n >= RATE_MAX
}

/** Rejects a POST whose `Origin` header names a different host than the one
 * that served the request — same check as api/scores.ts. */
function originLooksForeign(req: VercelRequest): boolean {
  const origin = req.headers.origin
  if (typeof origin !== 'string') return false
  const host = req.headers.host
  if (typeof host !== 'string') return false
  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isDbConfigured) {
    res.status(503).json({ error: 'Multiplayer is not configured on this deployment.' })
    return
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed.' })
    return
  }
  if (originLooksForeign(req)) {
    res.status(403).json({ error: 'Request rejected.' })
    return
  }

  try {
    if (await checkRateLimit(clientIp(req))) {
      res.status(429).json({ error: 'Slow down — too many rooms created.' })
      return
    }
    const body = (req.body ?? {}) as Record<string, unknown>
    const game = body.game
    if (!isMpGame(game)) {
      res.status(400).json({ error: 'Unknown or unsupported game.' })
      return
    }
    const name = sanitizePlayerName(body.name)
    if (!name) {
      res.status(400).json({ error: 'A name is required.' })
      return
    }

    const db = getDb()
    // Best-effort sweep of abandoned rooms.
    await db.delete(rooms).where(lt(rooms.updatedAt, new Date(Date.now() - 6 * 3600_000)))

    const seatId = randomUUID()
    const size = clampSeatCount(game, body.size)
    const seats: Seat[] = Array.from({ length: size }, (_, i) => (i === 0 ? { id: seatId, name } : null))

    // Retry a couple of times on the astronomically unlikely code collision.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = makeRoomCode()
      try {
        await db.insert(rooms).values({ code, game, phase: 'lobby', seats, hostId: seatId })
        res.status(201).json({ code, seatId, seat: 0 })
        return
      } catch {
        /* collision — try another code */
      }
    }
    res.status(500).json({ error: 'Could not allocate a room code.' })
  } catch (err) {
    console.error('[api/rooms]', err)
    res.status(500).json({ error: 'Could not create the room.' })
  }
}
