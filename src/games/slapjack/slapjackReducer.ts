import type { Card } from '../../types/card'

export type SlapjackPhase = 'flipping' | 'slap' | 'gameover'

export interface SlapjackState {
  /** Face-down stacks, index 0 = top. */
  playerPile: Card[]
  aiPile: Card[]
  /** Face-up centre pile, last = most recently flipped. */
  center: Card[]
  /** Whose card gets flipped next. */
  turn: 'player' | 'ai'
  phase: SlapjackPhase
  winner: 'player' | 'ai' | null
  /** Last event, newest-last. */
  log: string[]
  /** How many successful slaps each side has made (for flavour). */
  slaps: { player: number; ai: number }
}

export type SlapjackAction =
  | { type: 'START'; playerPile: Card[]; aiPile: Card[] }
  | { type: 'FLIP' }
  | { type: 'SLAP'; who: 'player' | 'ai' }
  | { type: 'RESET' }

export const isJack = (card: Card | undefined): boolean => card?.rank === 'JACK'

export const centerTop = (s: SlapjackState): Card | undefined => s.center[s.center.length - 1]

export function initSlapjack(): SlapjackState {
  return {
    playerPile: [],
    aiPile: [],
    center: [],
    turn: 'player',
    phase: 'flipping',
    winner: null,
    log: [],
    slaps: { player: 0, ai: 0 },
  }
}

const push = (log: string[], line: string): string[] => [...log, line].slice(-5)

function checkWin(s: SlapjackState): SlapjackState {
  const total = s.playerPile.length + s.aiPile.length + s.center.length
  if (s.aiPile.length === 0 && s.center.length === 0 && s.playerPile.length === total) {
    return { ...s, phase: 'gameover', winner: 'player', log: push(s.log, 'You hold every card — you win!') }
  }
  if (s.playerPile.length === 0 && s.center.length === 0 && s.aiPile.length === total) {
    return { ...s, phase: 'gameover', winner: 'ai', log: push(s.log, 'The dealer has every card. You lose.') }
  }
  return s
}

/**
 * Neither side has a card left to flip (every card sits in the centre with no
 * Jack to slap for). Decide it by who has landed more slaps; the player takes a
 * tie.
 */
function resolveBySlaps(s: SlapjackState): SlapjackState {
  const winner = s.slaps.player >= s.slaps.ai ? 'player' : 'ai'
  return {
    ...s,
    phase: 'gameover',
    winner,
    log: push(
      s.log,
      `No cards left to flip — most slaps takes it. ${winner === 'player' ? 'You win!' : 'You lose.'}`,
    ),
  }
}

export function slapjackReducer(state: SlapjackState, action: SlapjackAction): SlapjackState {
  switch (action.type) {
    case 'START':
      return {
        ...initSlapjack(),
        playerPile: action.playerPile,
        aiPile: action.aiPile,
        log: ['Flip cards to the centre. Slap the pile when a Jack lands.'],
      }

    case 'FLIP': {
      if (state.phase !== 'flipping') return state
      // Nobody can flip — the whole deck is stuck in the centre with no Jack up.
      if (state.playerPile.length === 0 && state.aiPile.length === 0) return resolveBySlaps(state)
      // The player whose turn it is flips; if they're empty, the other flips.
      let turn = state.turn
      if (turn === 'player' && state.playerPile.length === 0) turn = 'ai'
      if (turn === 'ai' && state.aiPile.length === 0) turn = 'player'
      const pile = turn === 'player' ? state.playerPile : state.aiPile
      const [card, ...rest] = pile
      const next: SlapjackState = {
        ...state,
        playerPile: turn === 'player' ? rest : state.playerPile,
        aiPile: turn === 'ai' ? rest : state.aiPile,
        center: [...state.center, card],
        turn: turn === 'player' ? 'ai' : 'player',
        phase: isJack(card) ? 'slap' : 'flipping',
      }
      // That was the last card and it isn't a Jack — no way to continue.
      if (next.playerPile.length === 0 && next.aiPile.length === 0 && next.phase === 'flipping') {
        return resolveBySlaps(next)
      }
      return next
    }

    case 'SLAP': {
      const { who } = action
      if (state.phase === 'slap' && isJack(centerTop(state))) {
        // Legal slap — win the centre pile.
        const winPile = state.center
        const playerPile = who === 'player' ? [...state.playerPile, ...winPile] : state.playerPile
        const aiPile = who === 'ai' ? [...state.aiPile, ...winPile] : state.aiPile
        return checkWin({
          ...state,
          playerPile,
          aiPile,
          center: [],
          phase: 'flipping',
          slaps: { ...state.slaps, [who]: state.slaps[who] + 1 },
          log: push(state.log, `${who === 'player' ? 'You' : 'Dealer'} slapped the Jack — ${winPile.length} cards.`),
        })
      }
      // False slap — hand a card to the other side.
      if (state.phase !== 'flipping' && state.phase !== 'slap') return state
      const from = who === 'player' ? state.playerPile : state.aiPile
      if (from.length === 0) return state
      const [penalty, ...rest] = from
      return checkWin({
        ...state,
        playerPile: who === 'player' ? rest : [...state.playerPile, penalty],
        aiPile: who === 'ai' ? rest : [...state.aiPile, penalty],
        log: push(state.log, `${who === 'player' ? 'You' : 'Dealer'} slapped early — one card forfeited.`),
      })
    }

    case 'RESET':
      return initSlapjack()

    default:
      return state
  }
}
