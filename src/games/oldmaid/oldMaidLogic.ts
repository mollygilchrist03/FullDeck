import type { Card, Rank } from '../../types/card'

/** Drop one Queen so a single Queen is left unpairable — the Old Maid. */
export function removeOneQueen(deck: Card[]): Card[] {
  const i = deck.findIndex((c) => c.rank === 'QUEEN')
  return i === -1 ? deck : [...deck.slice(0, i), ...deck.slice(i + 1)]
}

/**
 * Lay down every pair in a hand. Returns the trimmed hand (the odd card of each
 * rank stays) and one entry per discarded pair.
 */
export function discardPairs(hand: Card[]): { hand: Card[]; pairs: Rank[] } {
  const byRank = new Map<Rank, Card[]>()
  for (const c of hand) {
    const list = byRank.get(c.rank) ?? []
    list.push(c)
    byRank.set(c.rank, list)
  }
  const pairs: Rank[] = []
  const kept: Card[] = []
  for (const [rank, cards] of byRank) {
    for (let i = 0; i + 1 < cards.length; i += 2) pairs.push(rank)
    if (cards.length % 2 === 1) kept.push(cards[cards.length - 1])
  }
  return { hand: kept, pairs }
}
