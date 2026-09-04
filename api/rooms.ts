import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { lt } from 'drizzle-orm'
import { getDb, isDbConfigured } from '../db/client.js'
import { rooms } from '../db/schema.js'
import { isMpGame, makeRoomCode, sanitizePlayerName, type Seat } from '../src/lib/multiplayer.js'

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

  try {
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
    const seats: Seat[] = [{ id: seatId, name }, null]

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
