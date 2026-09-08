/**
 * Server-only auth helpers — password hashing, session cookies, brute-force
 * throttling. Imported by the `api/auth/*` serverless functions; not routable
 * itself (it lives outside `api/`). Keep relative imports `.js`-suffixed and
 * free of React, same as the rest of the serverless graph.
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { and, eq, gt, lt, sql } from 'drizzle-orm'
import type { Db } from '../db/client.js'
import { emailTokens, loginAttempts, sessions, users, type UserRow } from '../db/schema.js'

const SCRYPT_KEYLEN = 64
export const SESSION_TTL_MS = 30 * 24 * 3600_000 // 30 days
export const SESSION_COOKIE = 'fd_session'
const IP_SALT = process.env.IP_HASH_SALT ?? 'full-deck-rate-limit'

// Login throttle: at most this many attempts (success or fail) per IP per window.
const LOGIN_WINDOW_MS = 15 * 60_000
const LOGIN_MAX = 12

export interface PublicUser {
  id: number
  email: string
  displayName: string
  autoPost: boolean
  emailVerified: boolean
  hasPassword: boolean
  hasGoogle: boolean
}

export function publicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    autoPost: row.autoPost,
    emailVerified: row.emailVerified,
    hasPassword: row.passwordHash != null,
    hasGoogle: row.googleSub != null,
  }
}

/* ---- passwords ---- */

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), SCRYPT_KEYLEN)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/* ---- sessions ---- */

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')

export async function createSession(db: Db, userId: number): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt })
  return token
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

export async function sessionUser(db: Db, cookieHeader: string | undefined): Promise<UserRow | null> {
  const token = parseCookies(cookieHeader)[SESSION_COOKIE]
  if (!token) return null
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1)
  return rows[0]?.user ?? null
}

export async function destroySession(db: Db, cookieHeader: string | undefined): Promise<void> {
  const token = parseCookies(cookieHeader)[SESSION_COOKIE]
  if (!token) return
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)))
}

/** Drop every session for a user — used after a password reset. */
export async function destroyAllSessions(db: Db, userId: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId))
}

/* ---- one-time email tokens (verify / reset) ---- */

export type EmailTokenKind = 'verify' | 'reset'

export async function createEmailToken(
  db: Db,
  userId: number,
  kind: EmailTokenKind,
  ttlMs: number,
): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await db.insert(emailTokens).values({
    tokenHash: hashToken(token),
    userId,
    kind,
    expiresAt: new Date(Date.now() + ttlMs),
  })
  return token
}

/** Validate a token, delete it (one-time use), and return its user id. */
export async function consumeEmailToken(
  db: Db,
  token: string,
  kind: EmailTokenKind,
): Promise<number | null> {
  const tokenHash = hashToken(token)
  const [row] = await db
    .delete(emailTokens)
    .where(and(eq(emailTokens.tokenHash, tokenHash), eq(emailTokens.kind, kind)))
    .returning({ userId: emailTokens.userId, expiresAt: emailTokens.expiresAt })
  if (!row || row.expiresAt.getTime() < Date.now()) return null
  return row.userId
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor(
    SESSION_TTL_MS / 1000,
  )}`
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

/* ---- request helpers ---- */

type Headers = Record<string, string | string[] | undefined>

export function clientIp(headers: Headers, fallback = 'unknown'): string {
  const fwd = headers['x-forwarded-for']
  if (typeof fwd === 'string') return fwd.split(',')[0]!.trim()
  if (Array.isArray(fwd) && fwd[0]) return fwd[0]
  return fallback
}

/** True when a present `Origin` header names a host other than the one that
 * served the request. A missing Origin is not treated as suspicious. */
export function originLooksForeign(headers: Headers): boolean {
  const origin = headers.origin
  const host = headers.host
  if (typeof origin !== 'string' || typeof host !== 'string') return false
  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

/* ---- login throttle ---- */

/** Logs this attempt and reports whether the IP is already over the limit. */
export async function loginThrottled(db: Db, ip: string): Promise<boolean> {
  const ipHash = createHash('sha256').update(`${IP_SALT}:auth:${ip}`).digest('hex')
  const since = new Date(Date.now() - LOGIN_WINDOW_MS)
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.ipHash, ipHash), gt(loginAttempts.createdAt, since)))
  await db.insert(loginAttempts).values({ ipHash })
  if (Math.random() < 0.02) {
    void db
      .delete(loginAttempts)
      .where(lt(loginAttempts.createdAt, new Date(Date.now() - 24 * 3600_000)))
      .catch(() => {})
  }
  return n >= LOGIN_MAX
}
