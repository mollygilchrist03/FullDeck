import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
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

/**
 * A registered player. `passwordHash` is null for accounts created via Google
 * (and `googleSub` is null for pure email/password accounts); an account may
 * end up with both if the same email signs in each way. `email` is always
 * present — Google hands us one, and we require one on email signup.
 * `autoPost` opts the account into auto-submitting qualifying scores to the
 * global leaderboard under `displayName` instead of typing a name each time.
 */
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 254 }).notNull(),
    /** scrypt: `<saltHex>:<hashHex>`. Null for Google-only accounts. */
    passwordHash: text('password_hash'),
    /** Google's stable subject id. Null for email/password-only accounts. */
    googleSub: varchar('google_sub', { length: 255 }),
    displayName: varchar('display_name', { length: 20 }).notNull(),
    autoPost: boolean('auto_post').notNull().default(false),
    /** True once the address is confirmed via an emailed link. Informational —
     * nothing is gated on it; the account works from the moment it's made. */
    emailVerified: boolean('email_verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_idx').on(t.email),
    uniqueIndex('users_google_sub_idx').on(t.googleSub),
  ],
)

export type UserRow = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

/**
 * One row per active login. The cookie carries a random token; only its
 * SHA-256 hash is stored, so a database leak doesn't hand over live sessions.
 */
export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 hex of the session token from the cookie. */
    tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

export type SessionRow = typeof sessions.$inferSelect

/**
 * One-time tokens for email confirmation and password reset. Like sessions,
 * only the SHA-256 of the token is stored; the row is deleted on use.
 */
export const emailTokens = pgTable(
  'email_tokens',
  {
    tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 'verify' | 'reset' */
    kind: varchar('kind', { length: 16 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('email_tokens_user_idx').on(t.userId)],
)

export type EmailTokenRow = typeof emailTokens.$inferSelect

/**
 * A finished game recorded against an account — the "saved games" history.
 * `score` is the game's headline number (same metric the leaderboard uses);
 * `postedToLeaderboard` notes whether this result also went to the global board.
 */
export const gameResults = pgTable(
  'game_results',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    game: varchar('game', { length: 32 }).notNull(),
    score: integer('score').notNull(),
    /** Free-form one-liner, e.g. "Won — flush" or "Bust at 12 battles". */
    detail: varchar('detail', { length: 120 }),
    postedToLeaderboard: boolean('posted_to_leaderboard').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('game_results_user_time_idx').on(t.userId, t.createdAt)],
)

export type GameResultRow = typeof gameResults.$inferSelect
export type NewGameResult = typeof gameResults.$inferInsert

/**
 * One row per login attempt (success or failure), for brute-force throttling
 * that holds across serverless instances. Keyed on a salted IP hash and,
 * separately, the target email hash.
 */
export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: serial('id').primaryKey(),
    /** Salted SHA-256 of the client IP. */
    ipHash: varchar('ip_hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('login_attempts_ip_time_idx').on(t.ipHash, t.createdAt)],
)

export type LoginAttemptRow = typeof loginAttempts.$inferSelect
