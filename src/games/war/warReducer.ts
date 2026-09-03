import type { Card } from '../../types/card'
import { resolveBattle } from './warLogic'

export type WarPhase = 'idle' | 'ready' | 'war' | 'gameover'

export interface WarState {
  /** Face-down stock, index 0 = top. */
  playerPile: Card[]
  dealerPile: Card[]
  /** The cards currently face-up on the table, or null between battles. */
  playerCard: Card | null
  dealerCard: Card | null
  /** Cards staked from earlier ties this battle, waiting for a winner. */
  spoils: Card[]
  lastWinner: 'player' | 'dealer' | null
  /** Cards won on the most recent decisive battle (for a "+N" flourish). */
  lastPotSize: number
  battles: number
  phase: WarPhase
  winner: 'player' | 'dealer' | null
}

export type WarAction =
  | { type: 'START'; playerPile: Card[]; dealerPile: Card[] }
  | { type: 'FLIP' }
  | { type: 'RESET' }

export function initWar(): WarState {
  return {
    playerPile: [],
    dealerPile: [],
    playerCard: null,
    dealerCard: null,
    spoils: [],
    lastWinner: null,
    lastPotSize: 0,
    battles: 0,
    phase: 'idle',
    winner: null,
  }
}

function shuffle(cards: Card[]): Card[] {
  const out = [...cards]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function warReducer(state: WarState, action: WarAction): WarState {
  switch (action.type) {
    case 'START':
      return {
        ...initWar(),
        playerPile: action.playerPile,
        dealerPile: action.dealerPile,
        phase: 'ready',
      }

    case 'FLIP': {
      if (state.phase !== 'ready' && state.phase !== 'war') return state

      // A player who can't produce a card loses everything on the table.
      if (state.playerPile.length === 0) {
        return { ...state, phase: 'gameover', winner: 'dealer' }
      }
      if (state.dealerPile.length === 0) {
        return { ...state, phase: 'gameover', winner: 'player' }
      }

      const [playerCard, ...playerRest] = state.playerPile
      const [dealerCard, ...dealerRest] = state.dealerPile
      const { winner, pot } = resolveBattle(playerCard, dealerCard, state.spoils)
      const battles = state.battles + 1

      if (winner === null) {
        // Tie — stake both cards and flip again.
        return {
          ...state,
          playerPile: playerRest,
          dealerPile: dealerRest,
          playerCard,
          dealerCard,
          spoils: pot,
          battles,
          phase: 'war',
        }
      }

      const won = shuffle(pot)
      const playerPile = winner === 'player' ? [...playerRest, ...won] : playerRest
      const dealerPile = winner === 'dealer' ? [...dealerRest, ...won] : dealerRest
      const over = playerPile.length === 0 || dealerPile.length === 0

      return {
        ...state,
        playerPile,
        dealerPile,
        playerCard,
        dealerCard,
        spoils: [],
        lastWinner: winner,
        lastPotSize: pot.length,
        battles,
        phase: over ? 'gameover' : 'ready',
        winner: over ? winner : null,
      }
    }

    case 'RESET':
      return initWar()

    default:
      return state
  }
}
