import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, asc, desc, eq, gt, lt, sql } from 'drizzle-orm'
import { getDb, isDbConfigured } from '../db/client.js'
import { scores } from '../db/schema.js'
import {
  GAMES,
  isGameKey,
  isValidScore,
  sanitizeName,
  type GameKey,
} from '../src/lib/leaderboard.js'
import { isCleanName } from '../src/lib/profanity.js'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

// Best-effort per-instance rate limit: 8 submissions / minute / IP.
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 8
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > RATE_MAX
}

function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string') return fwd.split(',')[0]!.trim()
  if (Array.isArray(fwd) && fwd[0]) return fwd[0]
  return req.socket?.remoteAddress ?? 'unknown'
}

async function topEntries(game: GameKey, limit: number) {
  const db = getDb()
  const byScore = GAMES[game].higherIsBetter ? desc(scores.score) : asc(scores.score)
  return db
    .select({ name: scores.name, score: scores.score, createdAt: scores.createdAt })
    .from(scores)
    .where(eq(scores.game, game))
    .orderBy(byScore, asc(scores.createdAt))
    .limit(limit)
}

/** 1-based rank of a freshly inserted row: how many existing rows beat it. */
async function rankOf(game: GameKey, score: number, createdAt: Date): Promise<number> {
  const db = getDb()
  const beats = GAMES[game].higherIsBetter ? gt(scores.score, score) : lt(scores.score, score)
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(scores)
    .where(
      and(
        eq(scores.game, game),
        sql`(${beats} or (${scores.score} = ${score} and ${scores.createdAt} < ${createdAt.toISOString()}))`,
      ),
    )
  return n + 1
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isDbConfigured) {
    res.status(503).json({ error: 'The leaderboard is not configured on this deployment.' })
    return
  }

  try {
    if (req.method === 'GET') {
      const game = req.query.game
      if (!isGameKey(game)) {
        res.status(400).json({ error: 'Unknown or missing game.' })
        return
      }
      const rawLimit = Number(req.query.limit)
      const limit = Number.isFinite(rawLimit)
        ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(rawLimit)))
        : DEFAULT_LIMIT
      const entries = await topEntries(game, limit)
      res.status(200).json({ game, entries })
      return
    }

    if (req.method === 'POST') {
      if (rateLimited(clientIp(req))) {
        res.status(429).json({ error: 'Slow down — too many submissions.' })
        return
      }
      const body = (req.body ?? {}) as Record<string, unknown>
      const { game } = body
      if (!isGameKey(game)) {
        res.status(400).json({ error: 'Unknown or missing game.' })
        return
      }
      const name = sanitizeName(body.name)
      if (!name) {
        res.status(400).json({ error: 'A name is required.' })
        return
      }
      if (!isCleanName(name)) {
        res.status(400).json({ error: 'Please pick a name without profanity.' })
        return
      }
      if (!isValidScore(game, body.score)) {
        res.status(400).json({ error: 'Score is out of range.' })
        return
      }

      const db = getDb()
      const [row] = await db
        .insert(scores)
        .values({ game, name, score: body.score })
        .returning({ id: scores.id, createdAt: scores.createdAt })
      const rank = await rankOf(game, body.score, row.createdAt)
      res.status(201).json({ ok: true, rank })
      return
    }

    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ error: 'Method not allowed.' })
  } catch (err) {
    console.error('[api/scores]', err)
    res.status(500).json({ error: 'Something went wrong reaching the leaderboard.' })
  }
}
