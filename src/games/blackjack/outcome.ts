import type { Card } from '../../types/card'
import { isBlackjack, scoreHand } from './handScoring'

export type Outcome = 'blackjack' | 'win' | 'push' | 'loss'

/** Payout multiplier applied to the bet (net profit; the stake is returned on top for non-loss). */
export const PAYOUT_MULTIPLIER: Record<Outcome, number> = {
  blackjack: 1.5,
  win: 1,
  push: 0,
  loss: -1,
}

/**
 * Settle a finished hand from the player's point of view.
 * Assumes the dealer has already finished drawing. `playerNatural` is false for
 * hands formed by splitting — a two-card 21 there is an ordinary 21, not a
 * blackjack, and loses to a dealer natural.
 */
export function settle(player: Card[], dealer: Card[], playerNatural = true): Outcome {
  const playerTotal = scoreHand(player).total
  const dealerTotal = scoreHand(dealer).total
  const playerBJ = playerNatural && isBlackjack(player)
  const dealerBJ = isBlackjack(dealer)

  if (playerBJ || dealerBJ) {
    if (playerBJ && dealerBJ) return 'push'
    return playerBJ ? 'blackjack' : 'loss'
  }

  if (playerTotal > 21) return 'loss'
  if (dealerTotal > 21) return 'win'

  if (playerTotal > dealerTotal) return 'win'
  if (playerTotal < dealerTotal) return 'loss'
  return 'push'
}

export const OUTCOME_MESSAGE: Record<Outcome, string> = {
  blackjack: 'Blackjack! Paid 3 : 2.',
  win: 'You win!',
  push: 'Push — bet returned.',
  loss: 'Dealer wins.',
}
