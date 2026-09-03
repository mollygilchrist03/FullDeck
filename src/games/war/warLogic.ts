import type { Card } from '../../types/card'
import { rankValue } from '../../lib/rank'

export type Battle = 'player' | 'dealer' | 'war'

/** Compare two face-up cards by rank alone (suit is ignored, aces high). */
export function compareCards(player: Card, dealer: Card): Battle {
  const p = rankValue(player.rank)
  const d = rankValue(dealer.rank)
  if (p > d) return 'player'
  if (d > p) return 'dealer'
  return 'war'
}

/**
 * Simplified War: on a tie both cards go to a shared spoils pile and play
 * continues; whoever wins the next comparison takes the whole pile. (No
 * "three face-down" — keeps the state small and the outcome easy to reason
 * about.) `spoils` is everything already staked this battle, not counting the
 * two cards just flipped.
 */
export function resolveBattle(
  player: Card,
  dealer: Card,
  spoils: Card[],
): { winner: 'player' | 'dealer' | null; pot: Card[] } {
  const pot = [...spoils, player, dealer]
  const result = compareCards(player, dealer)
  if (result === 'war') return { winner: null, pot }
  return { winner: result, pot }
}
