import type { Card } from '../../types/card'
import { isBlackjack, isBust, scoreHand } from './handScoring'
import { PAYOUT_MULTIPLIER, settle, type Outcome } from './outcome'

export const STARTING_BANK = 100
export const CHIP_DENOMINATIONS = [5, 25, 100] as const

export type Phase = 'betting' | 'player' | 'dealer' | 'settled'

export interface BlackjackState {
  phase: Phase
  bank: number
  /** Proposed bet while betting; locked-in stake once a hand is dealt. */
  bet: number
  playerHand: Card[]
  dealerHand: Card[]
  /** Whether the dealer's second card is still face-down. */
  holeHidden: boolean
  result: Outcome | null
  /** Net change to the bank applied when the hand settled. */
  payout: number
  /** Increments each deal — used as an animation/render key. */
  handId: number
}

export type BlackjackAction =
  | { type: 'SET_BET'; amount: number }
  | { type: 'DEAL'; playerCards: Card[]; dealerCards: Card[] }
  | { type: 'HIT'; card: Card }
  | { type: 'STAND' }
  | { type: 'DEALER_RESOLVE'; dealerHand: Card[] }
  | { type: 'NEW_HAND' }
  | { type: 'RESET_BANK' }

export function initBlackjack(): BlackjackState {
  return {
    phase: 'betting',
    bank: STARTING_BANK,
    bet: Math.min(25, STARTING_BANK),
    playerHand: [],
    dealerHand: [],
    holeHidden: true,
    result: null,
    payout: 0,
    handId: 0,
  }
}

/** Apply the final dealer hand, settle, and move chips. */
function finish(state: BlackjackState, dealerHand: Card[]): BlackjackState {
  const result = settle(state.playerHand, dealerHand)
  const payout = Math.round(state.bet * PAYOUT_MULTIPLIER[result])
  return {
    ...state,
    dealerHand,
    holeHidden: false,
    phase: 'settled',
    result,
    payout,
    bank: state.bank + payout,
  }
}

export function blackjackReducer(state: BlackjackState, action: BlackjackAction): BlackjackState {
  switch (action.type) {
    case 'SET_BET': {
      if (state.phase !== 'betting') return state
      const amount = Math.max(0, Math.min(action.amount, state.bank))
      return { ...state, bet: amount }
    }

    case 'DEAL': {
      if (state.phase !== 'betting' || state.bet <= 0 || state.bet > state.bank) return state
      const base: BlackjackState = {
        ...state,
        playerHand: action.playerCards,
        dealerHand: action.dealerCards,
        holeHidden: true,
        result: null,
        payout: 0,
        handId: state.handId + 1,
        phase: 'player',
      }
      // A natural on either side ends the hand immediately.
      if (isBlackjack(action.playerCards) || isBlackjack(action.dealerCards)) {
        return finish(base, action.dealerCards)
      }
      return base
    }

    case 'HIT': {
      if (state.phase !== 'player') return state
      const playerHand = [...state.playerHand, action.card]
      const next = { ...state, playerHand }
      if (isBust(playerHand)) return finish(next, state.dealerHand)
      // Auto-stand on a hard/soft 21 — no reason to hit again.
      if (scoreHand(playerHand).total === 21) return { ...next, phase: 'dealer', holeHidden: false }
      return next
    }

    case 'STAND': {
      if (state.phase !== 'player') return state
      return { ...state, phase: 'dealer', holeHidden: false }
    }

    case 'DEALER_RESOLVE': {
      if (state.phase !== 'dealer') return state
      return finish(state, action.dealerHand)
    }

    case 'NEW_HAND': {
      if (state.phase !== 'settled') return state
      return {
        ...state,
        phase: 'betting',
        playerHand: [],
        dealerHand: [],
        holeHidden: true,
        result: null,
        payout: 0,
        bet: Math.min(state.bet || 25, state.bank),
      }
    }

    case 'RESET_BANK': {
      return { ...initBlackjack(), handId: state.handId }
    }

    default:
      return state
  }
}
