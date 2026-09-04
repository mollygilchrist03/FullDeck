import type { Card } from '../../types/card'
import { judge, type Guess, type Judgement } from './highLowLogic'

export type HighLowPhase = 'idle' | 'guessing' | 'revealed' | 'gameover' | 'won'

/** Cards in a single deck — clear them all without a wrong call and you win. */
export const DECK_SIZE = 52

export interface HighLowState {
  current: Card | null
  /** The card just turned over, shown until the player continues. */
  revealed: Card | null
  lastGuess: Guess | null
  lastJudgement: Judgement | null
  /** Consecutive correct guesses (pushes don't break it, don't extend it). */
  streak: number
  /** Cards turned over this run, including the starting card. */
  seen: number
  phase: HighLowPhase
}

export type HighLowAction =
  | { type: 'START'; first: Card }
  | { type: 'GUESS'; guess: Guess; next: Card }
  | { type: 'CONTINUE' }
  | { type: 'RESET' }

export function initHighLow(): HighLowState {
  return {
    current: null,
    revealed: null,
    lastGuess: null,
    lastJudgement: null,
    streak: 0,
    seen: 0,
    phase: 'idle',
  }
}

export function highLowReducer(state: HighLowState, action: HighLowAction): HighLowState {
  switch (action.type) {
    case 'START':
      return { ...initHighLow(), current: action.first, seen: 1, phase: 'guessing' }

    case 'GUESS': {
      if (state.phase !== 'guessing' || !state.current) return state
      const verdict = judge(state.current, action.next, action.guess)
      const seen = state.seen + 1
      const phase =
        verdict === 'wrong' ? 'gameover' : seen >= DECK_SIZE ? 'won' : 'revealed'
      return {
        ...state,
        revealed: action.next,
        lastGuess: action.guess,
        lastJudgement: verdict,
        streak: verdict === 'correct' ? state.streak + 1 : state.streak,
        seen,
        phase,
      }
    }

    case 'CONTINUE': {
      if (state.phase !== 'revealed' || !state.revealed) return state
      return { ...state, current: state.revealed, revealed: null, phase: 'guessing' }
    }

    case 'RESET':
      return initHighLow()

    default:
      return state
  }
}
