import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

export type Db = ReturnType<typeof drizzle<typeof schema>>

/** True when a database connection string is present in the environment. */
export const isDbConfigured = Boolean(process.env.DATABASE_URL)

let cached: Db | null = null

/**
 * Get the Drizzle client, or throw if `DATABASE_URL` is unset. Callers (the API
 * route) catch this and return a 503 so the app degrades gracefully instead of
 * crashing when the leaderboard hasn't been provisioned yet.
 */
export function getDb(): Db {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set — the leaderboard is not configured.')
  }
  if (!cached) {
    cached = drizzle(neon(process.env.DATABASE_URL), { schema })
  }
  return cached
}
