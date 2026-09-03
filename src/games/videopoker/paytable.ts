import type { HandCategory } from './pokerHand'

export const MAX_BET = 5

/** 9/6 Jacks or Better, payout per credit staked. */
export const PAY_PER_CREDIT: Record<HandCategory, number> = {
  'royal-flush': 250,
  'straight-flush': 50,
  'four-of-a-kind': 25,
  'full-house': 9,
  flush: 6,
  straight: 4,
  'three-of-a-kind': 3,
  'two-pair': 2,
  'jacks-or-better': 1,
  nothing: 0,
}

/**
 * Total returned for a result at a given bet. Linear in the bet, except the
 * royal flush jumps to 800/credit when the max bet is in — the reason to
 * always bet five.
 */
export function payout(category: HandCategory, bet: number): number {
  if (category === 'royal-flush' && bet === MAX_BET) return 800 * MAX_BET
  return PAY_PER_CREDIT[category] * bet
}
