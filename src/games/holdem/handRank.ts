/**
 * Texas Hold'em hand ranking — pure, no React, no network. Unlike the video
 * poker evaluator (which only ever sees exactly 5 cards and just needs a pay
 * category), showdown here compares the *best* 5-card hand out of up to 7
 * cards (2 hole + 5 community), and two hands in the same category need a
 * real tiebreak, not just a label.
 */
import type { Card } from '../../types/card'
import { rankValue } from '../../lib/rank'

export type HandCategory =
  | 'straight-flush'
  | 'four-of-a-kind'
  | 'full-house'
  | 'flush'
  | 'straight'
  | 'three-of-a-kind'
  | 'two-pair'
  | 'pair'
  | 'high-card'

export const CATEGORY_TIER: Record<HandCategory, number> = {
  'straight-flush': 9,
  'four-of-a-kind': 8,
  'full-house': 7,
  flush: 6,
  straight: 5,
  'three-of-a-kind': 4,
  'two-pair': 3,
  pair: 2,
  'high-card': 1,
}

export const CATEGORY_LABEL: Record<HandCategory, string> = {
  'straight-flush': 'Straight flush',
  'four-of-a-kind': 'Four of a kind',
  'full-house': 'Full house',
  flush: 'Flush',
  straight: 'Straight',
  'three-of-a-kind': 'Three of a kind',
  'two-pair': 'Two pair',
  pair: 'Pair',
  'high-card': 'High card',
}

export interface HandRank {
  category: HandCategory
  /** True only for an ace-high straight flush — a display detail, not a
   * separate tier: its tiebreak is already the highest possible. */
  royal: boolean
  /** Descending-significance values; compare two ranks element by element. */
  tiebreak: number[]
  /** The 5 cards this rank was built from. */
  cards: Card[]
}

function desc(values: number[]): number[] {
  return [...values].sort((a, b) => b - a)
}

/** Highest card of a straight run, or null if the 5 values aren't one.
 * Handles the wheel (A-2-3-4-5), whose "high card" for comparison is 5, not
 * the ace. */
function straightHigh(values: number[]): number | null {
  const uniq = [...new Set(values)].sort((a, b) => a - b)
  if (uniq.length !== 5) return null
  if (uniq[4] - uniq[0] === 4) return uniq[4]
  if (uniq.join(',') === '2,3,4,5,14') return 5
  return null
}

/** Rank exactly 5 cards. */
export function evaluateFive(cards: Card[]): HandRank {
  if (cards.length !== 5) throw new Error(`evaluateFive expects 5 cards, got ${cards.length}`)

  const values = cards.map((c) => rankValue(c.rank))
  const isFlush = cards.every((c) => c.suit === cards[0].suit)
  const high = straightHigh(values)

  const counts = new Map<number, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  // Groups sorted by (count desc, rank desc) — e.g. KKK99 -> [[13,3],[9,2]].
  const groups = [...counts.entries()].sort((a, b) => (b[1] - a[1]) || (b[0] - a[0]))
  const shape = groups.map(([, n]) => n)

  const make = (category: HandCategory, tiebreak: number[]): HandRank => ({
    category,
    royal: category === 'straight-flush' && tiebreak[0] === 14,
    tiebreak,
    cards,
  })

  if (isFlush && high !== null) return make('straight-flush', [high])
  if (shape[0] === 4) return make('four-of-a-kind', [groups[0][0], groups[1][0]])
  if (shape[0] === 3 && shape[1] === 2) return make('full-house', [groups[0][0], groups[1][0]])
  if (isFlush) return make('flush', desc(values))
  if (high !== null) return make('straight', [high])
  if (shape[0] === 3) {
    const kickers = desc(values.filter((v) => v !== groups[0][0]))
    return make('three-of-a-kind', [groups[0][0], ...kickers])
  }
  if (shape[0] === 2 && shape[1] === 2) {
    const [hi, lo] = [groups[0][0], groups[1][0]].sort((a, b) => b - a)
    const kicker = values.find((v) => v !== hi && v !== lo)!
    return make('two-pair', [hi, lo, kicker])
  }
  if (shape[0] === 2) {
    const kickers = desc(values.filter((v) => v !== groups[0][0]))
    return make('pair', [groups[0][0], ...kickers])
  }
  return make('high-card', desc(values))
}

/** -1 / 0 / 1, like a normal comparator: a > b means a wins the pot. */
export function compareHandRank(a: HandRank, b: HandRank): number {
  const tierDiff = CATEGORY_TIER[a.category] - CATEGORY_TIER[b.category]
  if (tierDiff !== 0) return Math.sign(tierDiff)
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i += 1) {
    const diff = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0)
    if (diff !== 0) return Math.sign(diff)
  }
  return 0
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  const [head, ...rest] = arr
  const withHead = combinations(rest, k - 1).map((c) => [head, ...c])
  const withoutHead = combinations(rest, k)
  return [...withHead, ...withoutHead]
}

/** Best possible 5-card hand out of any 5+ cards (2 hole + up to 5 community). */
export function bestHand(cards: Card[]): HandRank {
  if (cards.length < 5) throw new Error(`bestHand needs at least 5 cards, got ${cards.length}`)
  const candidates = combinations(cards, 5).map(evaluateFive)
  return candidates.reduce((best, r) => (compareHandRank(r, best) > 0 ? r : best))
}
