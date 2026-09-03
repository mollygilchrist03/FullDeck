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
 * Cards a side buries face-down going into a war: three, or as many as it can
 * spare while keeping one to turn face-up. A side with no cards can't continue.
 */
export function warBuryCount(pileSize: number): number {
  return Math.min(3, Math.max(0, pileSize - 1))
}
