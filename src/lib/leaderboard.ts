/**
 * Shared leaderboard config — imported by both the React app and the
 * `/api/scores` serverless function, so keep it free of DOM and Node APIs.
 */

export type GameKey =
  | 'blackjack'
  | 'memory'
  | 'high-low'
  | 'war'
  | 'video-poker'
  | 'crazy-eights'
  | 'slapjack'
  | 'go-fish'
  | 'trash'
  | 'old-maid'

export interface GameMeta {
  key: GameKey
  title: string
  /** What the number means, e.g. "Peak bank". */
  metricLabel: string
  /** One-line hint shown near the submit box. */
  metricHint: string
  unit: '$' | 's' | ''
  unitPosition: 'prefix' | 'suffix' | 'none'
  /** True: a bigger number ranks higher. False: smaller is better (times, move counts). */
  higherIsBetter: boolean
  /** Inclusive validation bounds — anything outside is rejected by the API. */
  min: number
  max: number
}

export const GAMES: Record<GameKey, GameMeta> = {
  blackjack: {
    key: 'blackjack',
    title: 'Blackjack',
    metricLabel: 'Peak bank',
    metricHint: 'The highest your chip stack reached this session.',
    unit: '$',
    unitPosition: 'prefix',
    higherIsBetter: true,
    min: 1,
    max: 1_000_000,
  },
  memory: {
    key: 'memory',
    title: 'Memory Match',
    metricLabel: 'Best 6×6 time',
    metricHint: 'Seconds to clear the 6×6 board.',
    unit: 's',
    unitPosition: 'suffix',
    higherIsBetter: false,
    min: 1,
    max: 3600,
  },
  'high-low': {
    key: 'high-low',
    title: 'High-Low',
    metricLabel: 'Longest streak',
    metricHint: 'Consecutive correct calls in one run.',
    unit: '',
    unitPosition: 'none',
    higherIsBetter: true,
    min: 1,
    max: 52,
  },
  war: {
    key: 'war',
    title: 'War',
    metricLabel: 'Fewest battles',
    metricHint: 'Battles played in a game you won.',
    unit: '',
    unitPosition: 'none',
    higherIsBetter: false,
    min: 1,
    max: 5000,
  },
  'video-poker': {
    key: 'video-poker',
    title: 'Video Poker',
    metricLabel: 'Biggest win',
    metricHint: 'Largest payout from a single hand.',
    unit: '$',
    unitPosition: 'prefix',
    higherIsBetter: true,
    min: 1,
    max: 100_000,
  },
  'crazy-eights': {
    key: 'crazy-eights',
    title: 'Crazy Eights',
    metricLabel: 'Cards left on the AI',
    metricHint: "Cards stuck in the opponent's hand when you went out.",
    unit: '',
    unitPosition: 'none',
    higherIsBetter: true,
    min: 1,
    max: 51,
  },
  slapjack: {
    key: 'slapjack',
    title: 'Slapjack',
    metricLabel: 'Fastest slap (ms)',
    metricHint: 'Your quickest reaction on a winning slap, in milliseconds.',
    unit: '',
    unitPosition: 'none',
    higherIsBetter: false,
    min: 60,
    max: 3000,
  },
  'go-fish': {
    key: 'go-fish',
    title: 'Go Fish',
    metricLabel: 'Books collected',
    metricHint: 'Complete sets of four you finished a winning game with.',
    unit: '',
    unitPosition: 'none',
    higherIsBetter: true,
    min: 1,
    max: 13,
  },
  trash: {
    key: 'trash',
    title: 'Trash',
    metricLabel: 'Fewest turns',
    metricHint: 'Turns taken to complete your row in a game you won.',
    unit: '',
    unitPosition: 'none',
    higherIsBetter: false,
    min: 1,
    max: 200,
  },
  'old-maid': {
    key: 'old-maid',
    title: 'Old Maid',
    metricLabel: 'Fewest draws',
    metricHint: 'Draws you took before the dealer was left with the Old Maid.',
    unit: '',
    unitPosition: 'none',
    higherIsBetter: false,
    min: 1,
    max: 60,
  },
}

export const GAME_KEYS = Object.keys(GAMES) as GameKey[]

export function isGameKey(value: unknown): value is GameKey {
  return typeof value === 'string' && value in GAMES
}

export const NAME_MAX = 20

/** Strip control characters, collapse whitespace, trim, cap length. May return ''. */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  let out = ''
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0
    // Drop non-printable controls, but keep tab/newline/CR so they collapse to a space.
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127) continue
    out += ch
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX)
}

/** A submitted score must be a finite integer within the game's bounds. */
export function isValidScore(game: GameKey, score: unknown): score is number {
  if (typeof score !== 'number' || !Number.isFinite(score) || !Number.isInteger(score)) {
    return false
  }
  const { min, max } = GAMES[game]
  return score >= min && score <= max
}

/** SQL order direction for the leaderboard of a given game. */
export function sortDirection(game: GameKey): 'asc' | 'desc' {
  return GAMES[game].higherIsBetter ? 'desc' : 'asc'
}

export function formatScore(game: GameKey, score: number): string {
  const meta = GAMES[game]
  if (meta.unitPosition === 'prefix') return `${meta.unit}${score.toLocaleString()}`
  if (meta.unitPosition === 'suffix') return `${score.toLocaleString()}${meta.unit}`
  return score.toLocaleString()
}
