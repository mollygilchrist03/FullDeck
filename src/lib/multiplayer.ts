import type { GameKey } from './leaderboard.js'

/** Games that support an online room. */
export const MP_GAMES = [
  'war',
  'crazy-eights',
  'slapjack',
  'go-fish',
  'trash',
  'old-maid',
  'holdem',
] as const satisfies readonly GameKey[]

export type MpGameKey = (typeof MP_GAMES)[number]

export function isMpGame(value: unknown): value is MpGameKey {
  return typeof value === 'string' && (MP_GAMES as readonly string[]).includes(value)
}

/** How many seats a game's room can hold. Every game here plays exactly two
 * except Hold'em, whose rules (and betting engine) genuinely scale to a
 * table — the host picks a size in that range when creating the room. */
export const SEAT_RANGE: Record<MpGameKey, { min: number; max: number }> = {
  war: { min: 2, max: 2 },
  'crazy-eights': { min: 2, max: 6 },
  slapjack: { min: 2, max: 6 },
  'go-fish': { min: 2, max: 6 },
  trash: { min: 2, max: 4 },
  'old-maid': { min: 2, max: 6 },
  holdem: { min: 2, max: 6 },
}

export function clampSeatCount(game: MpGameKey, size: unknown): number {
  const { min, max } = SEAT_RANGE[game]
  const n = typeof size === 'number' && Number.isInteger(size) ? size : min
  return Math.min(max, Math.max(min, n))
}

/** Unambiguous code alphabet — no 0/O/1/I/L. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 6

/** A random 6-character join code. */
export function makeRoomCode(): string {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return out
}

/** Normalise a user-typed code: uppercase, strip anything not in the alphabet. */
export function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((c) => CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, CODE_LENGTH)
}

export function isValidCode(value: string): boolean {
  return value.length === CODE_LENGTH && normalizeCode(value) === value
}

export const PLAYER_NAME_MAX = 16

export function sanitizePlayerName(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  let out = ''
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0
    if ((code < 32 && code !== 9) || code === 127) continue
    out += ch
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, PLAYER_NAME_MAX)
}

export type Seat = { id: string; name: string } | null

/** What a client receives about a room (seat ids stripped except its own index). */
export interface RoomView {
  code: string
  game: MpGameKey
  phase: 'lobby' | 'playing' | 'done'
  /** Seat display names (or null for an empty seat). */
  seats: (string | null)[]
  version: number
  /** The game reducer's state, or null in the lobby. */
  state: unknown
  /** Which seat this client holds, or null for a spectator. */
  youSeat: number | null
  /** True if this client is the host. */
  youHost: boolean
}
