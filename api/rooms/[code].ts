import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { getDb, isDbConfigured } from '../../db/client.js'
import { rooms, type RoomRow } from '../../db/schema.js'
import {
  normalizeCode,
  sanitizePlayerName,
  type MpGameKey,
  type RoomView,
  type Seat,
} from '../../src/lib/multiplayer.js'
import { GAME_SERVERS, freshDeck } from '../../src/lib/gameServer.js'

export const maxDuration = 30

const POLL_MS = 700
const POLL_BUDGET_MS = 24_000

function view(room: RoomRow, seatId: string | undefined): RoomView {
  const seats = room.seats as Seat[]
  const idx = seatId ? seats.findIndex((s) => s?.id === seatId) : -1
  return {
    code: room.code,
    game: room.game as MpGameKey,
    phase: room.phase as RoomView['phase'],
    seats: seats.map((s) => s?.name ?? null),
    version: room.version,
    state: room.state ?? null,
    youSeat: idx >= 0 ? idx : null,
    youHost: !!seatId && room.hostId === seatId,
  }
}

async function loadRoom(code: string): Promise<RoomRow | undefined> {
  const db = getDb()
  const [row] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1)
  return row
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isDbConfigured) {
    res.status(503).json({ error: 'Multiplayer is not configured on this deployment.' })
    return
  }

  const code = normalizeCode(String(req.query.code ?? ''))
  if (code.length !== 6) {
    res.status(400).json({ error: 'Bad room code.' })
    return
  }

  try {
    if (req.method === 'GET') {
      const seatId = typeof req.query.seatId === 'string' ? req.query.seatId : undefined
      const since = Number(req.query.since)
      const wait = req.query.wait === '1' && Number.isFinite(since)
      const deadline = Date.now() + POLL_BUDGET_MS

      for (;;) {
        const room = await loadRoom(code)
        if (!room) {
          res.status(404).json({ error: 'Room not found.' })
          return
        }
        if (!wait || room.version > since || Date.now() >= deadline) {
          res.status(200).json(view(room, seatId))
          return
        }
        await sleep(POLL_MS)
      }
    }

    if (req.method === 'POST') {
      const body = (req.body ?? {}) as Record<string, unknown>
      const op = body.op
      const room = await loadRoom(code)
      if (!room) {
        res.status(404).json({ error: 'Room not found.' })
        return
      }
      const db = getDb()
      const seats = room.seats as Seat[]

      if (op === 'join') {
        const name = sanitizePlayerName(body.name)
        if (!name) {
          res.status(400).json({ error: 'A name is required.' })
          return
        }
        const open = seats.findIndex((s) => s === null)
        if (open === -1) {
          res.status(409).json({ error: 'That room is full.' })
          return
        }
        const seatId = randomUUID()
        const nextSeats = seats.map((s, i) => (i === open ? { id: seatId, name } : s))
        const [updated] = await db
          .update(rooms)
          .set({ seats: nextSeats, version: room.version + 1, updatedAt: new Date() })
          .where(and(eq(rooms.code, code), eq(rooms.version, room.version)))
          .returning()
        if (!updated) {
          res.status(409).json({ error: 'Someone just took that seat — try again.' })
          return
        }
        res.status(200).json({ seatId, seat: open, room: view(updated, seatId) })
        return
      }

      const seatId = typeof body.seatId === 'string' ? body.seatId : ''
      const seatIndex = seats.findIndex((s) => s?.id === seatId)
      if (seatIndex === -1) {
        res.status(403).json({ error: 'You are not seated in this room.' })
        return
      }

      if (op === 'start' || op === 'rematch') {
        if (room.hostId !== seatId) {
          res.status(403).json({ error: 'Only the host can do that.' })
          return
        }
        if (seats.some((s) => s === null)) {
          res.status(409).json({ error: 'Waiting for both players.' })
          return
        }
        const server = GAME_SERVERS[room.game as MpGameKey]
        if (!server) {
          res.status(400).json({ error: 'That game has no server implementation yet.' })
          return
        }
        const state = server.deal(await freshDeck())
        const [updated] = await db
          .update(rooms)
          .set({
            state,
            phase: server.isOver(state) ? 'done' : 'playing',
            version: room.version + 1,
            updatedAt: new Date(),
          })
          .where(and(eq(rooms.code, code), eq(rooms.version, room.version)))
          .returning()
        res.status(200).json(view(updated ?? room, seatId))
        return
      }

      if (op === 'action') {
        if (room.phase !== 'playing') {
          res.status(409).json({ error: 'The game is not in progress.' })
          return
        }
        const server = GAME_SERVERS[room.game as MpGameKey]!
        const action = body.action
        if (!server.authorize(room.state, seatIndex, action)) {
          res.status(403).json({ error: "That's not a move you can make right now." })
          return
        }
        const next = server.reduce(room.state, action)
        if (next === room.state) {
          res.status(200).json(view(room, seatId)) // no-op
          return
        }
        const [updated] = await db
          .update(rooms)
          .set({
            state: next,
            phase: server.isOver(next) ? 'done' : 'playing',
            version: room.version + 1,
            updatedAt: new Date(),
          })
          .where(and(eq(rooms.code, code), eq(rooms.version, room.version)))
          .returning()
        if (!updated) {
          const fresh = await loadRoom(code)
          res.status(409).json({ error: 'Out of sync.', room: fresh ? view(fresh, seatId) : null })
          return
        }
        res.status(200).json(view(updated, seatId))
        return
      }

      res.status(400).json({ error: 'Unknown op.' })
      return
    }

    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ error: 'Method not allowed.' })
  } catch (err) {
    console.error('[api/rooms/[code]]', err)
    res.status(500).json({ error: 'Room request failed.' })
  }
}
