import type { Rank } from '../types/card'

/** Ranks low → high, aces high. Index + 2 is the "natural" value (2..14). */
export const RANK_ORDER: Rank[] = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'JACK',
  'QUEEN',
  'KING',
  'ACE',
]

/** Numeric value of a rank with aces high: 2 → 2 … KING → 13, ACE → 14. */
export function rankValue(rank: Rank): number {
  return RANK_ORDER.indexOf(rank) + 2
}
