/**
 * The AI's decision policy — a pure function of the state, like every other
 * game's AI in this project (Crazy Eights' chooseAiPlay, Go Fish's
 * chooseAiAsk, ...). Deliberately deterministic rather than randomised: it
 * estimates hand strength on a 0..1 scale, compares it to the pot odds it's
 * being offered, and folds / calls / value-bets accordingly. The tradeoff is
 * a human can eventually learn its exact thresholds, same as any other AI here.
 */
import type { Card } from '../../types/card.js'
import { rankValue } from '../../lib/rank.js'
import { bestHand, type HandCategory } from './handRank.js'
import { BIG_BLIND, potTotal, revealedBoard, toCall, type HoldemState } from './holdemReducer.js'

export type AiDecision = { type: 'FOLD' } | { type: 'CHECK' } | { type: 'CALL' } | { type: 'BET'; to: number }

/** Rough 0..1 preflop strength from two hole cards alone — pair rank, high
 * cards, suitedness, and connectedness (closer ranks play better). */
export function preflopStrength(hole: [Card, Card]): number {
  const [a, b] = [rankValue(hole[0].rank), rankValue(hole[1].rank)].sort((x, y) => y - x)
  const suited = hole[0].suit === hole[1].suit
  const gap = a - b
  let score = a + b
  if (a === b) score += 22 // a pocket pair is worth far more than the sum of its ranks
  if (suited) score += 3
  if (gap === 1) score += 2
  else if (gap === 2) score += 1
  return Math.min(1, score / 52)
}

// Postflop, made-hand category maps to a strength band with a lifted floor —
// so "ace-high nothing" sits around 0.24, "top pair" around 0.44, "two pair"
// around 0.6, sets and better clearly above that. (The earlier version
// squashed everything below two pair into ~0.05-0.2, which made the AI fold
// essentially every hand that missed the flop and never value-bet a pair.)
const POSTFLOP_BASE: Record<HandCategory, number> = {
  'high-card': 0.1,
  pair: 0.3,
  'two-pair': 0.52,
  'three-of-a-kind': 0.68,
  straight: 0.78,
  flush: 0.85,
  'full-house': 0.92,
  'four-of-a-kind': 0.97,
  'straight-flush': 1,
}

/** 0..1 hand strength: the preflop heuristic before the flop, otherwise the
 * made-hand band plus a nudge from how high its primary rank is. */
export function handStrength(hole: [Card, Card], board: Card[]): number {
  if (board.length < 3) return preflopStrength(hole)
  const rank = bestHand([...hole, ...board])
  return Math.min(1, POSTFLOP_BASE[rank.category] + ((rank.tiebreak[0] ?? 0) / 14) * 0.14)
}

/** The AI's move for the given seat. Only ever called when it's that seat's turn. */
export function chooseAiAction(state: HoldemState, seat: number): AiDecision {
  const st = state.seats[seat]
  const strength = handStrength(st.hole as [Card, Card], revealedBoard(state))
  const call = toCall(state, seat)
  const pot = potTotal(state)
  const stack = st.stack
  const liveOpponents = state.seats.filter((s, i) => i !== seat && !s.folded && !s.eliminated).length

  if (call === 0) {
    // Nothing to call — value-bet a real hand, check air and marginal spots.
    if (stack > 0 && strength >= 0.4) {
      const frac = strength >= 0.72 ? 0.75 : strength >= 0.55 ? 0.6 : 0.45
      const size = Math.max(BIG_BLIND, Math.round(Math.max(pot, BIG_BLIND) * frac))
      return { type: 'BET', to: st.bet + Math.min(stack, size) }
    }
    return { type: 'CHECK' }
  }

  // Facing a bet. Fold only when the price is clearly worse than the hand —
  // a little slack so it doesn't fold every thin spot and become exploitable.
  // More live opponents means less equity for the same hand, so tighten the
  // continue threshold a bit per extra opponent.
  const potOdds = call / (pot + call)
  const slack = 0.05 - 0.02 * Math.max(0, liveOpponents - 1)
  if (strength + slack < potOdds) return { type: 'FOLD' }
  if (strength >= 0.66 && stack > call) {
    const raiseBy = Math.max(BIG_BLIND, Math.round(pot * 0.7))
    return { type: 'BET', to: st.bet + call + Math.min(stack - call, raiseBy) }
  }
  return { type: 'CALL' }
}
