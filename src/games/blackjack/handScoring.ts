import type { Card, Rank } from '../../types/card'

export interface HandScore {
  /** Best total that does not bust, if one exists; otherwise the minimum total. */
  total: number
  /** True when an ace is still being counted as 11 (a "soft" hand). */
  soft: boolean
}

const BASE_VALUE: Record<Rank, number> = {
  ACE: 11,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  JACK: 10,
  QUEEN: 10,
  KING: 10,
}

/**
 * Score a Blackjack hand.
 *
 * Aces start at 11; while the hand is over 21 and an ace is still counted high,
 * demote one ace from 11 to 1 (subtract 10) and try again. Whatever aces remain
 * high at the end make the hand "soft".
 */
export function scoreHand(cards: Card[]): HandScore {
  let total = 0
  let aces = 0

  for (const card of cards) {
    total += BASE_VALUE[card.rank]
    if (card.rank === 'ACE') aces += 1
  }

  let acesHigh = aces
  while (total > 21 && acesHigh > 0) {
    total -= 10
    acesHigh -= 1
  }

  return { total, soft: acesHigh > 0 }
}

export function isBust(cards: Card[]): boolean {
  return scoreHand(cards).total > 21
}

/** A "natural": exactly two cards totalling 21. */
export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && scoreHand(cards).total === 21
}
