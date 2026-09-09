import type { Card } from '../../types/card.js'

export type SlapjackPhase = 'flipping' | 'slap' | 'gameover'

export interface SlapjackState {
  /** Face-down stacks, one per seat, index 0 = top. */
  piles: Card[][]
  /** Face-up centre pile, last = most recently flipped. */
  center: Card[]
  /** Seat index whose card gets flipped next. */
  turn: number
  phase: SlapjackPhase
  /** Seat index once one seat holds every card. */
  winner: number | null
  /** Last event, newest-last. */
  log: string[]
  /** How many successful slaps each seat has made — the tiebreaker if the
   * whole deck ends up stuck in the centre with no Jack to slap for. */
  slaps: number[]
}

export type SlapjackAction =
  | { type: 'START'; piles: Card[][] }
  | { type: 'FLIP' }
  | { type: 'SLAP'; who: number }
  | { type: 'RESET' }

export const isJack = (card: Card | undefined): boolean => card?.rank === 'JACK'

export const centerTop = (s: SlapjackState): Card | undefined => s.center[s.center.length - 1]

export function initSlapjack(seatCount: number): SlapjackState {
  return {
    piles: Array.from({ length: seatCount }, () => []),
    center: [],
    turn: 0,
    phase: 'flipping',
    winner: null,
    log: [],
    slaps: Array.from({ length: seatCount }, () => 0),
  }
}

const push = (log: string[], line: string): string[] => [...log, line].slice(-5)

/** Next seat (wrapping) whose pile still has cards — used to hand the flip
 * on when the seat whose turn it is has already run dry. */
function nextNonEmpty(piles: Card[][], from: number): number {
  const n = piles.length
  for (let step = 1; step <= n; step += 1) {
    const i = (from + step) % n
    if (piles[i].length > 0) return i
  }
  return from
}

function checkWin(s: SlapjackState): SlapjackState {
  const total = s.piles.reduce((sum, p) => sum + p.length, 0) + s.center.length
  const winner = s.piles.findIndex((p) => p.length === total)
  if (winner === -1) return s
  return {
    ...s,
    phase: 'gameover',
    winner,
    log: push(s.log, `Seat ${winner + 1} holds every card and wins!`),
  }
}

/**
 * Nobody has a card left to flip (every card sits in the centre with no
 * Jack to slap for). Decide it by who has landed more slaps; the lowest
 * seat index takes a tie.
 */
function resolveBySlaps(s: SlapjackState): SlapjackState {
  const most = Math.max(...s.slaps)
  const winner = s.slaps.findIndex((n) => n === most)
  return {
    ...s,
    phase: 'gameover',
    winner,
    log: push(s.log, `No cards left to flip — Seat ${winner + 1} takes it on most slaps.`),
  }
}

export function slapjackReducer(state: SlapjackState, action: SlapjackAction): SlapjackState {
  switch (action.type) {
    case 'START':
      return {
        ...initSlapjack(action.piles.length),
        piles: action.piles,
        log: ['Flip cards to the centre. Slap the pile when a Jack lands.'],
      }

    case 'FLIP': {
      if (state.phase !== 'flipping') return state
      // Nobody can flip — the whole deck is stuck in the centre with no Jack up.
      if (state.piles.every((p) => p.length === 0)) return resolveBySlaps(state)
      // Whoever's turn it is flips; if they've already run dry, skip to the
      // next seat that still has cards.
      const seat = state.piles[state.turn].length > 0 ? state.turn : nextNonEmpty(state.piles, state.turn)
      const [flipped, ...rest] = state.piles[seat]
      const piles = state.piles.map((p, i) => (i === seat ? rest : p))
      const next: SlapjackState = {
        ...state,
        piles,
        center: [...state.center, flipped],
        turn: nextNonEmpty(piles, seat),
        phase: isJack(flipped) ? 'slap' : 'flipping',
      }
      // That was the last card and it isn't a Jack — no way to continue.
      if (next.phase === 'flipping' && next.piles.every((p) => p.length === 0)) {
        return resolveBySlaps(next)
      }
      return next
    }

    case 'SLAP': {
      const { who } = action
      if (state.phase === 'slap' && isJack(centerTop(state))) {
        // Legal slap — win the centre pile.
        const winPile = state.center
        const piles = state.piles.map((p, i) => (i === who ? [...p, ...winPile] : p))
        const slaps = state.slaps.map((n, i) => (i === who ? n + 1 : n))
        return checkWin({
          ...state,
          piles,
          center: [],
          phase: 'flipping',
          slaps,
          log: push(state.log, `Seat ${who + 1} slapped the Jack — ${winPile.length} cards.`),
        })
      }
      // False slap — forfeit a card to the next seat in rotation.
      if (state.phase !== 'flipping' && state.phase !== 'slap') return state
      const from = state.piles[who]
      if (from.length === 0) return state
      const [penalty, ...rest] = from
      const target = (who + 1) % state.piles.length
      const piles = state.piles.map((p, i) => {
        if (i === who) return rest
        if (i === target) return [...p, penalty]
        return p
      })
      return checkWin({
        ...state,
        piles,
        log: push(state.log, `Seat ${who + 1} slapped early — one card forfeited.`),
      })
    }

    case 'RESET':
      return initSlapjack(state.piles.length)

    default:
      return state
  }
}
