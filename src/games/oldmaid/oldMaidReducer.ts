import type { Card, Rank } from '../../types/card'
import { discardPairs } from './oldMaidLogic.js'

export type OldMaidPhase = 'playerTurn' | 'aiTurn' | 'gameover'

export interface OldMaidState {
  playerHand: Card[]
  aiHand: Card[]
  /** One rank per pair each side has laid down. */
  playerDiscards: Rank[]
  aiDiscards: Rank[]
  turn: 'player' | 'ai'
  phase: OldMaidPhase
  /** Draws the player has made — the score for a win. */
  turnsTaken: number
  lastDraw: { who: 'player' | 'ai'; rank: Rank; paired: boolean } | null
  log: string[]
  /** The side NOT left holding the Old Maid. */
  winner: 'player' | 'ai' | null
}

export type OldMaidAction =
  | { type: 'START'; playerHand: Card[]; aiHand: Card[] }
  | { type: 'DRAW'; index: number }
  | { type: 'RESET' }

const push = (log: string[], line: string): string[] => [...log, line].slice(-6)

export function initOldMaid(): OldMaidState {
  return {
    playerHand: [],
    aiHand: [],
    playerDiscards: [],
    aiDiscards: [],
    turn: 'player',
    phase: 'playerTurn',
    turnsTaken: 0,
    lastDraw: null,
    log: [],
    winner: null,
  }
}

/** 50 cards pair off; the last card left anywhere is the lone Queen. */
function checkOver(s: OldMaidState): OldMaidState {
  if (s.playerHand.length + s.aiHand.length > 1) return s
  const winner: 'player' | 'ai' = s.playerHand.length === 0 ? 'player' : 'ai'
  return {
    ...s,
    phase: 'gameover',
    winner,
    log: push(
      s.log,
      winner === 'player'
        ? 'The dealer is stuck with the Old Maid — you win!'
        : 'You are left holding the Old Maid. You lose.',
    ),
  }
}

export function oldMaidReducer(state: OldMaidState, action: OldMaidAction): OldMaidState {
  switch (action.type) {
    case 'START': {
      const p = discardPairs(action.playerHand)
      const a = discardPairs(action.aiHand)
      return checkOver({
        ...initOldMaid(),
        playerHand: p.hand,
        aiHand: a.hand,
        playerDiscards: p.pairs,
        aiDiscards: a.pairs,
        log: ['Pairs laid down. Draw a card from the dealer.'],
      })
    }

    case 'DRAW': {
      if (state.phase !== 'playerTurn' && state.phase !== 'aiTurn') return state
      const drawer = state.turn
      const oppHand = drawer === 'player' ? state.aiHand : state.playerHand
      if (action.index < 0 || action.index >= oppHand.length) return state

      const card = oppHand[action.index]
      const newOpp = [...oppHand.slice(0, action.index), ...oppHand.slice(action.index + 1)]

      let myHand = drawer === 'player' ? state.playerHand : state.aiHand
      let discards = drawer === 'player' ? state.playerDiscards : state.aiDiscards
      const matchIdx = myHand.findIndex((c) => c.rank === card.rank)
      const paired = matchIdx >= 0
      if (paired) {
        myHand = [...myHand.slice(0, matchIdx), ...myHand.slice(matchIdx + 1)]
        discards = [...discards, card.rank]
      } else {
        myHand = [...myHand, card]
      }

      const who = drawer === 'player' ? 'You' : 'The dealer'
      const next: OldMaidState = {
        ...state,
        playerHand: drawer === 'player' ? myHand : newOpp,
        aiHand: drawer === 'ai' ? myHand : newOpp,
        playerDiscards: drawer === 'player' ? discards : state.playerDiscards,
        aiDiscards: drawer === 'ai' ? discards : state.aiDiscards,
        turn: drawer === 'player' ? 'ai' : 'player',
        phase: drawer === 'player' ? 'aiTurn' : 'playerTurn',
        turnsTaken: drawer === 'player' ? state.turnsTaken + 1 : state.turnsTaken,
        lastDraw: { who: drawer, rank: card.rank, paired },
        log: push(state.log, `${who} drew a ${card.rank.toLowerCase()}${paired ? ' — paired and discarded.' : '.'}`),
      }
      return checkOver(next)
    }

    case 'RESET':
      return initOldMaid()

    default:
      return state
  }
}
