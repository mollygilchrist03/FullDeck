import type { Card, Rank } from '../../types/card.js'
import { discardPairs } from './oldMaidLogic.js'

export type OldMaidPhase = 'turn' | 'gameover'

export interface OldMaidState {
  /** One hand per seat. */
  hands: Card[][]
  /** One array of laid-down pair ranks per seat. */
  discards: Rank[][]
  /** Seat index whose turn it is to draw. */
  turn: number
  phase: OldMaidPhase
  /** Draws seat 0 has made — the score for a solo win. */
  turnsTaken: number
  lastDraw: { who: number; rank: Rank; paired: boolean } | null
  log: string[]
  /** Seat index left holding the Old Maid, once the game ends. */
  loser: number | null
}

export type OldMaidAction =
  | { type: 'START'; hands: Card[][] }
  | { type: 'DRAW'; index: number }
  | { type: 'RESET' }

const push = (log: string[], line: string): string[] => [...log, line].slice(-6)

export function initOldMaid(seatCount: number): OldMaidState {
  return {
    hands: Array.from({ length: seatCount }, () => []),
    discards: Array.from({ length: seatCount }, () => []),
    turn: 0,
    phase: 'turn',
    turnsTaken: 0,
    lastDraw: null,
    log: [],
    loser: null,
  }
}

/** Next seat (wrapping) that still holds at least one card — you can only
 * draw from a seat with something to give. A seat that hits 0 is skipped as
 * a draw target for the rest of the game (nobody ever hands them a card
 * again), which is exactly what makes them permanently done. */
export function nextLiveSeat(hands: Card[][], from: number): number {
  const n = hands.length
  for (let step = 1; step <= n; step += 1) {
    const i = (from + step) % n
    if (hands[i].length > 0) return i
  }
  return from
}

/** Only pairs ever leave the table, so the total card count is always odd
 * and never increases — it bottoms out at exactly 1 (the lone Queen), held
 * by exactly one seat. */
function checkOver(s: OldMaidState): OldMaidState {
  const total = s.hands.reduce((sum, h) => sum + h.length, 0)
  if (total > 1) return s
  const loser = s.hands.findIndex((h) => h.length === 1)
  return {
    ...s,
    phase: 'gameover',
    loser,
    log: push(
      s.log,
      loser === 0
        ? "You're left holding the Old Maid. You lose."
        : `Seat ${loser + 1} is stuck with the Old Maid.`,
    ),
  }
}

export function oldMaidReducer(state: OldMaidState, action: OldMaidAction): OldMaidState {
  switch (action.type) {
    case 'START': {
      const dealt = action.hands.map((h) => discardPairs(h))
      return checkOver({
        ...initOldMaid(action.hands.length),
        hands: dealt.map((d) => d.hand),
        discards: dealt.map((d) => d.pairs),
        log: ['Pairs laid down. Draw a card from your neighbor.'],
      })
    }

    case 'DRAW': {
      if (state.phase !== 'turn') return state
      const drawer = state.turn
      const target = nextLiveSeat(state.hands, drawer)
      const targetHand = state.hands[target]
      if (action.index < 0 || action.index >= targetHand.length) return state

      const drawn = targetHand[action.index]
      const newTargetHand = targetHand.filter((_, i) => i !== action.index)
      const drawerHand = state.hands[drawer]
      const matchIdx = drawerHand.findIndex((c) => c.rank === drawn.rank)
      const paired = matchIdx >= 0
      const newDrawerHand = paired
        ? drawerHand.filter((_, i) => i !== matchIdx)
        : [...drawerHand, drawn]

      const hands = state.hands.map((h, i) => {
        if (i === drawer) return newDrawerHand
        if (i === target) return newTargetHand
        return h
      })
      const discards = paired
        ? state.discards.map((d, i) => (i === drawer ? [...d, drawn.rank] : d))
        : state.discards

      const next: OldMaidState = {
        ...state,
        hands,
        discards,
        turn: target,
        turnsTaken: drawer === 0 ? state.turnsTaken + 1 : state.turnsTaken,
        lastDraw: { who: drawer, rank: drawn.rank, paired },
        log: push(
          state.log,
          `Seat ${drawer + 1} drew a ${drawn.rank.toLowerCase()}${paired ? ' — paired and discarded.' : '.'}`,
        ),
      }
      return checkOver(next)
    }

    case 'RESET':
      return initOldMaid(state.hands.length)

    default:
      return state
  }
}
