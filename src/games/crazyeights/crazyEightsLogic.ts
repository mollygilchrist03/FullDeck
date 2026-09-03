import type { Card, Suit } from '../../types/card'

export const SUITS: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES']

/**
 * A card is playable if it's an eight (always wild), matches the suit currently
 * in force, or matches the rank of the card on top of the discard pile.
 */
export function isPlayable(card: Card, top: Card, activeSuit: Suit): boolean {
  return card.rank === '8' || card.suit === activeSuit || card.rank === top.rank
}

export function playableCards(hand: Card[], top: Card, activeSuit: Suit): Card[] {
  return hand.filter((c) => isPlayable(c, top, activeSuit))
}

/** The suit the hand holds most of — what an AI nominates after playing an 8. */
export function strongestSuit(hand: Card[]): Suit {
  const counts = new Map<Suit, number>(SUITS.map((s) => [s, 0]))
  for (const c of hand) if (c.rank !== '8') counts.set(c.suit, (counts.get(c.suit) ?? 0) + 1)
  let best: Suit = 'SPADES'
  let bestN = -1
  for (const s of SUITS) {
    const n = counts.get(s) ?? 0
    if (n > bestN) {
      best = s
      bestN = n
    }
  }
  return best
}

export interface AiPlay {
  card: Card
  /** Set only when `card` is an eight. */
  suit?: Suit
}

/**
 * Pick a card for the AI to play, or null to draw. Heuristic: play a matching
 * non-eight if possible (saving eights as escape hatches), preferring one that
 * keeps the active suit; otherwise play an eight and nominate its strongest
 * suit.
 */
export function chooseAiPlay(hand: Card[], top: Card, activeSuit: Suit): AiPlay | null {
  const playable = playableCards(hand, top, activeSuit)
  if (playable.length === 0) return null

  const nonEights = playable.filter((c) => c.rank !== '8')
  if (nonEights.length > 0) {
    const keepSuit = nonEights.find((c) => c.suit === activeSuit)
    return { card: keepSuit ?? nonEights[0] }
  }

  const eight = playable[0]
  const remaining = hand.filter((c) => c !== eight)
  return { card: eight, suit: strongestSuit(remaining) }
}
