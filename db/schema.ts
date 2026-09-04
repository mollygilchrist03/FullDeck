import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * One row per submitted score. `score` is always stored as-is; the ranking
 * direction (higher- vs lower-is-better) lives in the shared game config and is
 * applied at query time.
 */
export const scores = pgTable(
  'scores',
  {
    id: serial('id').primaryKey(),
    game: varchar('game', { length: 32 }).notNull(),
    name: varchar('name', { length: 20 }).notNull(),
    score: integer('score').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('scores_game_score_idx').on(t.game, t.score)],
)

export type ScoreRow = typeof scores.$inferSelect
export type NewScore = typeof scores.$inferInsert

/**
 * One row per score-submission attempt (valid or not), for a Postgres-backed
 * rate limit that holds across serverless instances — the in-memory limiter in
 * `api/scores.ts` only holds within one warm instance. `ipHash` is a salted
 * SHA-256 of the submitter's IP, never the IP itself.
 */
export const submissionLog = pgTable(
  'submission_log',
  {
    id: serial('id').primaryKey(),
    ipHash: varchar('ip_hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('submission_log_ip_time_idx').on(t.ipHash, t.createdAt)],
)

export type SubmissionLogRow = typeof submissionLog.$inferSelect

/**
 * One row per multiplayer room. `state` holds the game's reducer state (or null
 * in the lobby); `seats` is a fixed-length array of seat holders. `version`
 * increments on every mutation and drives long-poll updates.
 */
export const rooms = pgTable(
  'rooms',
  {
    /** 6-char join code, unambiguous alphabet. */
    code: varchar('code', { length: 6 }).primaryKey(),
    game: varchar('game', { length: 32 }).notNull(),
    /** 'lobby' | 'playing' | 'done' */
    phase: varchar('phase', { length: 16 }).notNull().default('lobby'),
    /** Array of { id, name } | null, one per seat. */
    seats: jsonb('seats').notNull(),
    /** Secret seat-holder id of the host (may start the game). */
    hostId: text('host_id').notNull(),
    /** The game reducer's state, or null before start. */
    state: jsonb('state'),
    version: integer('version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('rooms_updated_idx').on(t.updatedAt)],
)

export type RoomRow = typeof rooms.$inferSelect
export type NewRoom = typeof rooms.$inferInsert
