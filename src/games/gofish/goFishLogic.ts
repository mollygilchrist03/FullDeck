import type { Card, Rank } from '../../types/card'

/** Pull every completed set of four from a hand. Returns the trimmed hand + book ranks. */
export function takeBooks(hand: Card[]): { hand: Card[]; books: Rank[] } {
  const byRank = new Map<Rank, Card[]>()
  for (const c of hand) {
    const list = byRank.get(c.rank) ?? []
    list.push(c)
    byRank.set(c.rank, list)
  }
  const books: Rank[] = []
  const kept: Card[] = []
  for (const [rank, cards] of byRank) {
    if (cards.length === 4) books.push(rank)
    else kept.push(...cards)
  }
  return { hand: kept, books }
}

export function ranksIn(hand: Card[]): Rank[] {
  return [...new Set(hand.map((c) => c.rank))]
}

export function countRank(hand: Card[], rank: Rank): number {
  return hand.filter((c) => c.rank === rank).length
}

/**
 * The AI's ask: a rank it holds, favouring one the player is known to hold
 * (from an earlier request), otherwise the rank it has the most of.
 */
export function chooseAiAsk(aiHand: Card[], knownPlayerRanks: Rank[]): Rank | null {
  const mine = ranksIn(aiHand)
  if (mine.length === 0) return null
  const known = mine.find((r) => knownPlayerRanks.includes(r))
  if (known) return known
  return mine.reduce((best, r) => (countRank(aiHand, r) > countRank(aiHand, best) ? r : best), mine[0])
}
