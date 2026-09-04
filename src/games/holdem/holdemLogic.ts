/**
 * The AI's decision policy — a pure function of the state, like every other
 * game's AI in this project (Crazy Eights' chooseAiPlay, Go Fish's
 * chooseAiAsk, ...). Deliberately deterministic rather than randomised: it
 * estimates hand strength, compares it to the pot odds it's being offered,
 * and folds/calls/raises accordingly. That makes it fully unit-testable
 * without seeding randomness — the tradeoff is a human can eventually learn
 * its exact thresholds, same as any other AI here.
 */
import type { Card } from '../../types/card'
import { rankValue } from '../../lib/rank'
import { bestHand } from './handRank'
import { BIG_BLIND, revealedBoard, toCall, type HoldemState } from './holdemReducer'

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

/** 0..1 hand strength: the preflop heuristic before the flop, otherwise the
 * actual best-hand category/kickers once there's a board to read. */
export function handStrength(hole: [Card, Card], board: Card[]): number {
  if (board.length < 3) return preflopStrength(hole)
  const rank = bestHand([...hole, ...board])
  // 9 categories; fold in the top tiebreak value for a little resolution
  // within a category (e.g. top pair of aces > top pair of twos).
  return Math.min(1, (tierOf(rank.category) - 1 + (rank.tiebreak[0] ?? 0) / 14) / 9)
}

const TIERS = [
  'high-card',
  'pair',
  'two-pair',
  'three-of-a-kind',
  'straight',
  'flush',
  'full-house',
  'four-of-a-kind',
  'straight-flush',
] as const
function tierOf(category: (typeof TIERS)[number]): number {
  return TIERS.indexOf(category) + 1
}

/** The AI's move for the current state. Only ever called when it's the AI's turn. */
export function chooseAiAction(state: HoldemState): AiDecision {
  const strength = handStrength(state.aiHole as [Card, Card], revealedBoard(state))
  const call = toCall(state, 'ai')
  const pot = state.pot + state.playerBet + state.aiBet
  const stack = state.aiStack

  if (call === 0) {
    if (stack > 0 && strength >= 0.5) {
      const size = Math.max(BIG_BLIND, Math.round(Math.max(pot, BIG_BLIND) * (strength >= 0.85 ? 0.9 : 0.5)))
      return { type: 'BET', to: state.aiBet + Math.min(stack, size) }
    }
    return { type: 'CHECK' }
  }

  const potOdds = call / (pot + call)
  if (strength < potOdds) return { type: 'FOLD' }
  if (strength >= 0.65 && stack > call) {
    const raiseBy = Math.max(BIG_BLIND, Math.round(pot * 0.75))
    return { type: 'BET', to: state.aiBet + call + Math.min(stack - call, raiseBy) }
  }
  return { type: 'CALL' }
}
