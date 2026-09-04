import type { Card } from '../../types/card'
import { compareCards, warBuryCount } from './warLogic.js'

export type WarPhase = 'idle' | 'ready' | 'war' | 'gameover'

export interface WarState {
  /** Face-down stock, index 0 = top. */
  playerPile: Card[]
  dealerPile: Card[]
  /** The cards currently face-up on the table, or null between battles. */
  playerCard: Card | null
  dealerCard: Card | null
  /** Every card staked this battle from ties and wars, awaiting a winner. */
  pot: Card[]
  /** Face-down cards buried on the most recent war round (for display). */
  buried: number
  lastWinner: 'player' | 'dealer' | null
  /** Cards won on the most recent decisive battle. */
  lastPotSize: number
  battles: number
  phase: WarPhase
  winner: 'player' | 'dealer' | null
  /**
   * Multiplayer only: has this side clicked Battle for the pending flip yet?
   * A flip only resolves once both are true (then both reset to false).
   * Untouched — always false — when FLIP is sent without a `side` (solo play).
   */
  readyPlayer: boolean
  readyDealer: boolean
}

export type WarAction =
  | { type: 'START'; playerPile: Card[]; dealerPile: Card[] }
  | { type: 'FLIP'; side?: 'player' | 'dealer' }
  | { type: 'RESET' }

export function initWar(): WarState {
  return {
    playerPile: [],
    dealerPile: [],
    playerCard: null,
    dealerCard: null,
    pot: [],
    buried: 0,
    lastWinner: null,
    lastPotSize: 0,
    battles: 0,
    phase: 'idle',
    winner: null,
    readyPlayer: false,
    readyDealer: false,
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

/** Award every card in play to `winner`; end the game if the loser is now empty. */
function award(state: WarState, winner: 'player' | 'dealer', faceUps: Card[]): WarState {
  const spoils = shuffle([...state.pot, ...faceUps])
  const playerPile = winner === 'player' ? [...state.playerPile, ...spoils] : state.playerPile
  const dealerPile = winner === 'dealer' ? [...state.dealerPile, ...spoils] : state.dealerPile
  const over = playerPile.length === 0 || dealerPile.length === 0
  return {
    ...state,
    playerPile,
    dealerPile,
    playerCard: state.playerCard,
    dealerCard: state.dealerCard,
    pot: [],
    lastWinner: winner,
    lastPotSize: spoils.length,
    phase: over ? 'gameover' : 'ready',
    winner: over ? winner : null,
  }
}

/** The actual battle — both piles flip and the outcome resolves. */
function resolveFlip(state: WarState): WarState {
  const battles = state.battles + 1

  // A player who can't produce a face-up card loses; the other side sweeps
  // the table.
  const onTable = [
    ...state.pot,
    ...(state.playerCard ? [state.playerCard] : []),
    ...(state.dealerCard ? [state.dealerCard] : []),
  ]
  if (state.playerPile.length === 0) {
    return {
      ...state,
      dealerPile: [...state.dealerPile, ...onTable],
      pot: [],
      playerCard: null,
      dealerCard: null,
      phase: 'gameover',
      winner: 'dealer',
    }
  }
  if (state.dealerPile.length === 0) {
    return {
      ...state,
      playerPile: [...state.playerPile, ...onTable],
      pot: [],
      playerCard: null,
      dealerCard: null,
      phase: 'gameover',
      winner: 'player',
    }
  }

  if (state.phase === 'ready') {
    const [playerCard, ...playerRest] = state.playerPile
    const [dealerCard, ...dealerRest] = state.dealerPile
    const result = compareCards(playerCard, dealerCard)
    const mid = {
      ...state,
      playerPile: playerRest,
      dealerPile: dealerRest,
      playerCard,
      dealerCard,
      buried: 0,
      battles,
    }
    // The two tied cards stay face-up for display and fold into the pot on
    // the next flip.
    if (result === 'war') return { ...mid, phase: 'war' }
    return award(mid, result, [playerCard, dealerCard])
  }

  // phase === 'war': fold the tied face-ups into the pot, then each side
  // buries up to three face-down and turns one up.
  const carried = [
    ...state.pot,
    ...(state.playerCard ? [state.playerCard] : []),
    ...(state.dealerCard ? [state.dealerCard] : []),
  ]
  const pBury = warBuryCount(state.playerPile.length)
  const dBury = warBuryCount(state.dealerPile.length)
  const pBuried = state.playerPile.slice(0, pBury)
  const dBuried = state.dealerPile.slice(0, dBury)
  const pAfter = state.playerPile.slice(pBury)
  const dAfter = state.dealerPile.slice(dBury)
  const [playerCard, ...playerRest] = pAfter
  const [dealerCard, ...dealerRest] = dAfter
  const potAfterBury = [...carried, ...pBuried, ...dBuried]
  const result = compareCards(playerCard, dealerCard)
  const mid = {
    ...state,
    playerPile: playerRest,
    dealerPile: dealerRest,
    playerCard,
    dealerCard,
    pot: potAfterBury,
    buried: pBury + dBury,
    battles,
  }
  // Another tie: the new face-ups stay shown and fold in on the next flip.
  if (result === 'war') return { ...mid, phase: 'war' }
  return award(mid, result, [playerCard, dealerCard])
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

      if (!action.side) return resolveFlip(state) // solo play — resolve immediately

      // Multiplayer: both sides must ready up before a flip actually happens.
      const next = {
        ...state,
        readyPlayer: state.readyPlayer || action.side === 'player',
        readyDealer: state.readyDealer || action.side === 'dealer',
      }
      if (!(next.readyPlayer && next.readyDealer)) return next
      return resolveFlip({ ...next, readyPlayer: false, readyDealer: false })
    }

    case 'RESET':
      return initWar()

    default:
      return state
  }
}
