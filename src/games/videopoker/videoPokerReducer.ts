import type { Card } from '../../types/card'
import { evaluateHand, type HandCategory } from './pokerHand'
import { MAX_BET, payout } from './paytable'

export const STARTING_BANK = 100

export type VideoPokerPhase = 'bet' | 'holding' | 'result'

export interface VideoPokerResult {
  category: HandCategory
  payout: number
}

export interface VideoPokerState {
  phase: VideoPokerPhase
  hand: Card[]
  /** Parallel to `hand` — which cards the player is keeping. */
  held: boolean[]
  bank: number
  bet: number
  result: VideoPokerResult | null
  handId: number
}

export type VideoPokerAction =
  | { type: 'SET_BET'; amount: number }
  | { type: 'DEAL'; cards: Card[] }
  | { type: 'TOGGLE_HOLD'; index: number }
  | { type: 'DRAW'; replacements: Card[] }
  | { type: 'NEW_HAND' }
  | { type: 'RESET_BANK' }

export function initVideoPoker(): VideoPokerState {
  return {
    phase: 'bet',
    hand: [],
    held: [false, false, false, false, false],
    bank: STARTING_BANK,
    bet: Math.min(MAX_BET, STARTING_BANK),
    result: null,
    handId: 0,
  }
}

/** Indexes the player did NOT hold — the ones that get replaced on the draw. */
export function drawSlots(held: boolean[]): number[] {
  return held.map((h, i) => (h ? -1 : i)).filter((i) => i >= 0)
}

export function videoPokerReducer(
  state: VideoPokerState,
  action: VideoPokerAction,
): VideoPokerState {
  switch (action.type) {
    case 'SET_BET': {
      if (state.phase !== 'bet') return state
      const amount = Math.max(1, Math.min(action.amount, MAX_BET, state.bank))
      return { ...state, bet: amount }
    }

    case 'DEAL': {
      if (state.phase !== 'bet' || state.bet < 1 || state.bet > state.bank) return state
      return {
        ...state,
        hand: action.cards,
        held: [false, false, false, false, false],
        bank: state.bank - state.bet,
        result: null,
        phase: 'holding',
        handId: state.handId + 1,
      }
    }

    case 'TOGGLE_HOLD': {
      if (state.phase !== 'holding') return state
      const held = state.held.map((h, i) => (i === action.index ? !h : h))
      return { ...state, held }
    }

    case 'DRAW': {
      if (state.phase !== 'holding') return state
      const slots = drawSlots(state.held)
      if (action.replacements.length < slots.length) return state
      const hand = [...state.hand]
      slots.forEach((slot, i) => {
        hand[slot] = action.replacements[i]
      })
      const category = evaluateHand(hand)
      const won = payout(category, state.bet)
      return {
        ...state,
        hand,
        held: state.held.map(() => true),
        bank: state.bank + won,
        result: { category, payout: won },
        phase: 'result',
      }
    }

    case 'NEW_HAND': {
      if (state.phase !== 'result') return state
      return {
        ...state,
        phase: 'bet',
        hand: [],
        held: [false, false, false, false, false],
        result: null,
        bet: Math.min(state.bet || 1, MAX_BET, state.bank),
      }
    }

    case 'RESET_BANK':
      return { ...initVideoPoker(), handId: state.handId }

    default:
      return state
  }
}
