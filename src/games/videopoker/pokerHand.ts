import type { Card } from '../../types/card'
import { rankValue } from '../../lib/rank'

export type HandCategory =
  | 'royal-flush'
  | 'straight-flush'
  | 'four-of-a-kind'
  | 'full-house'
  | 'flush'
  | 'straight'
  | 'three-of-a-kind'
  | 'two-pair'
  | 'jacks-or-better'
  | 'nothing'

export const CATEGORY_LABEL: Record<HandCategory, string> = {
  'royal-flush': 'Royal flush',
  'straight-flush': 'Straight flush',
  'four-of-a-kind': 'Four of a kind',
  'full-house': 'Full house',
  flush: 'Flush',
  straight: 'Straight',
  'three-of-a-kind': 'Three of a kind',
  'two-pair': 'Two pair',
  'jacks-or-better': 'Jacks or better',
  nothing: 'No pay',
}

/** Distinct rank values sorted ascending; also handles the A-2-3-4-5 wheel. */
function straightRun(cards: Card[]): boolean {
  const values = [...new Set(cards.map((c) => rankValue(c.rank)))].sort((a, b) => a - b)
  if (values.length !== 5) return false
  if (values[4] - values[0] === 4) return true
  // Wheel: Ace (14) plays low below the 2.
  return values.join(',') === '2,3,4,5,14'
}

/**
 * Evaluate a 5-card poker hand for a Jacks-or-Better machine.
 * Order of checks matters — the first match wins.
 */
export function evaluateHand(cards: Card[]): HandCategory {
  if (cards.length !== 5) {
    throw new Error(`evaluateHand expects 5 cards, got ${cards.length}`)
  }

  const isFlush = cards.every((c) => c.suit === cards[0].suit)
  const isStraight = straightRun(cards)

  const counts = new Map<string, number>()
  for (const c of cards) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1)
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const shape = groups.map(([, n]) => n) // e.g. [3, 2] for a full house

  if (isStraight && isFlush) {
    const lowestIsTen = Math.min(...cards.map((c) => rankValue(c.rank))) === 10
    return lowestIsTen ? 'royal-flush' : 'straight-flush'
  }
  if (shape[0] === 4) return 'four-of-a-kind'
  if (shape[0] === 3 && shape[1] === 2) return 'full-house'
  if (isFlush) return 'flush'
  if (isStraight) return 'straight'
  if (shape[0] === 3) return 'three-of-a-kind'
  if (shape[0] === 2 && shape[1] === 2) return 'two-pair'
  if (shape[0] === 2) {
    const pairRank = groups[0][0]
    return rankValue(pairRank as Card['rank']) >= 11 ? 'jacks-or-better' : 'nothing'
  }
  return 'nothing'
}
