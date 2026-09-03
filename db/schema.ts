import { index, integer, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core'

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
