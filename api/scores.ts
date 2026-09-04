import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, asc, desc, eq, gt, lt, sql } from 'drizzle-orm'
import { getDb, isDbConfigured } from '../db/client.js'
import { scores, submissionLog } from '../db/schema.js'
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

// Rate limit: 8 submissions / minute / IP. Backed by a `submission_log` table
// rather than an in-memory Map — a Map only holds within one warm serverless
// instance, so a burst that lands on several cold instances would sail
// straight through it. Every attempt (valid or not) is logged first, so
// spamming invalid bodies doesn't get a free pass around the limit.
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 8
// Never store a raw IP — salt-and-hash it. The salt just needs to be secret
// and stable; it doesn't need to be a real secret manager entry.
const IP_SALT = process.env.IP_HASH_SALT ?? 'full-deck-rate-limit'
// Cheap unbounded-growth guard: no cron job, so opportunistically sweep old
// rows on a small fraction of requests instead.
const CLEANUP_CHANCE = 0.02
const LOG_RETENTION_MS = 60 * 60_000

function hashIp(ip: string): string {
  return createHash('sha256').update(`${IP_SALT}:${ip}`).digest('hex')
}

/** Logs this attempt and reports whether the IP is already over the limit. */
async function checkRateLimit(ip: string): Promise<boolean> {
  const db = getDb()
  const ipHash = hashIp(ip)
  const since = new Date(Date.now() - RATE_WINDOW_MS)

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(submissionLog)
    .where(and(eq(submissionLog.ipHash, ipHash), gt(submissionLog.createdAt, since)))

  await db.insert(submissionLog).values({ ipHash })

  if (Math.random() < CLEANUP_CHANCE) {
    void db
      .delete(submissionLog)
      .where(lt(submissionLog.createdAt, new Date(Date.now() - LOG_RETENTION_MS)))
      .catch(() => {})
  }

  return n >= RATE_MAX
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
      if (await checkRateLimit(clientIp(req))) {
        res.status(429).json({ error: 'Slow down — too many submissions.' })
        return
      }
      const body = (req.body ?? {}) as Record<string, unknown>

      // Honeypot: a real form leaves `website` empty. A bot that blindly
      // fills every input usually doesn't. Report success without touching
      // the database — telling a bot "rejected" only teaches it to adapt.
      if (typeof body.website === 'string' && body.website.trim() !== '') {
        res.status(201).json({ ok: true })
        return
      }

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
