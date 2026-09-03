import type { Card } from '../../types/card'
import { scoreHand } from './handScoring'

/**
 * Standard dealer rule: draw until the hand totals 17 or more, then stand —
 * including on a soft 17 (this table is "S17"). Pure function of the hand.
 */
export function dealerShouldHit(hand: Card[]): boolean {
  return scoreHand(hand).total < 17
}

/**
 * Play out the dealer's turn. `drawOne` supplies the next card (from the deck,
 * a test stub, whatever) — this keeps the AI free of network or UI concerns.
 * Returns a new hand; the input is not mutated.
 */
export function playDealerHand(hand: Card[], drawOne: () => Card): Card[] {
  const result = [...hand]
  while (dealerShouldHit(result)) {
    result.push(drawOne())
  }
  return result
}
