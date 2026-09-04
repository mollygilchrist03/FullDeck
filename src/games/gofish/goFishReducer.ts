import type { Card, Rank } from '../../types/card'
import { chooseAiAsk, countRank, takeBooks } from './goFishLogic'

export type GoFishPhase = 'playerAsk' | 'playerDraw' | 'aiTurn' | 'gameover'

export interface GoFishState {
  playerHand: Card[]
  aiHand: Card[]
  stock: Card[]
  playerBooks: Rank[]
  aiBooks: Rank[]
  phase: GoFishPhase
  /**
   * During 'playerDraw': the rank the player asked for. If the card they fish up
   * matches, their turn continues. Null for an empty-hand "draw up".
   */
  pendingRank: Rank | null
  /** Ranks the player has asked for — the AI's memory. */
  knownPlayerRanks: Rank[]
  /** Increments each AI_STEP so the container can keep stepping. */
  aiSteps: number
  turnsTaken: number
  log: string[]
  winner: 'player' | 'ai' | null
}

export type GoFishAction =
  | { type: 'START'; playerHand: Card[]; aiHand: Card[]; stock: Card[] }
  | { type: 'ASK'; rank: Rank }
  | { type: 'DRAW' }
  | { type: 'AI_STEP' }
  | { type: 'RESET' }

const RANK_LABEL: Record<Rank, string> = {
  ACE: 'Aces',
  '2': '2s',
  '3': '3s',
  '4': '4s',
  '5': '5s',
  '6': '6s',
  '7': '7s',
  '8': '8s',
  '9': '9s',
  '10': '10s',
  JACK: 'Jacks',
  QUEEN: 'Queens',
  KING: 'Kings',
}

const push = (log: string[], line: string): string[] => [...log, line].slice(-6)

export function initGoFish(): GoFishState {
  return {
    playerHand: [],
    aiHand: [],
    stock: [],
    playerBooks: [],
    aiBooks: [],
    phase: 'playerAsk',
    pendingRank: null,
    knownPlayerRanks: [],
    aiSteps: 0,
    turnsTaken: 0,
    log: [],
    winner: null,
  }
}

function bookAndCheck(state: GoFishState): GoFishState {
  const p = takeBooks(state.playerHand)
  const a = takeBooks(state.aiHand)
  const playerBooks = [...state.playerBooks, ...p.books]
  const aiBooks = [...state.aiBooks, ...a.books]
  let log = state.log
  for (const b of p.books) log = push(log, `You completed a book of ${RANK_LABEL[b]}.`)
  for (const b of a.books) log = push(log, `Dealer completed a book of ${RANK_LABEL[b]}.`)

  const next: GoFishState = {
    ...state,
    playerHand: p.hand,
    aiHand: a.hand,
    playerBooks,
    aiBooks,
    knownPlayerRanks: state.knownPlayerRanks.filter((r) => !p.books.includes(r)),
    log,
  }

  const allGone =
    next.playerHand.length === 0 && next.aiHand.length === 0 && next.stock.length === 0
  if (playerBooks.length + aiBooks.length === 13 || allGone) {
    const winner = playerBooks.length >= aiBooks.length ? 'player' : 'ai'
    return {
      ...next,
      phase: 'gameover',
      winner,
      log: push(log, winner === 'player' ? 'All books made — you win!' : 'All books made — the dealer wins.'),
    }
  }
  return next
}

/**
 * Hand the turn to the player. With cards in hand they ask; with an empty hand
 * and a live stock they must click to draw up (Bicycle rule); with nothing to
 * draw the turn bounces back to the AI.
 */
function toPlayerTurn(state: GoFishState): GoFishState {
  if (state.phase === 'gameover') return state
  if (state.playerHand.length === 0) {
    return state.stock.length > 0
      ? { ...state, phase: 'playerDraw', pendingRank: null }
      : { ...state, phase: 'aiTurn' }
  }
  return { ...state, phase: 'playerAsk', pendingRank: null }
}

/** Draw one card into the given side's hand if the stock has any. */
function drawFor(state: GoFishState, side: 'player' | 'ai'): { state: GoFishState; drawn: Card | null } {
  if (state.stock.length === 0) return { state, drawn: null }
  const [drawn, ...stock] = state.stock
  return {
    state: {
      ...state,
      stock,
      playerHand: side === 'player' ? [...state.playerHand, drawn] : state.playerHand,
      aiHand: side === 'ai' ? [...state.aiHand, drawn] : state.aiHand,
    },
    drawn,
  }
}

export function goFishReducer(state: GoFishState, action: GoFishAction): GoFishState {
  switch (action.type) {
    case 'START': {
      const seeded: GoFishState = {
        ...initGoFish(),
        playerHand: action.playerHand,
        aiHand: action.aiHand,
        stock: action.stock,
        log: ['Ask the dealer for a rank you already hold.'],
      }
      return toPlayerTurn(bookAndCheck(seeded))
    }

    case 'ASK': {
      if (state.phase !== 'playerAsk') return state
      if (countRank(state.playerHand, action.rank) === 0) return state
      const known = state.knownPlayerRanks.includes(action.rank)
        ? state.knownPlayerRanks
        : [...state.knownPlayerRanks, action.rank]

      const taken = state.aiHand.filter((c) => c.rank === action.rank)
      const turnsTaken = state.turnsTaken + 1

      if (taken.length > 0) {
        const s = bookAndCheck({
          ...state,
          knownPlayerRanks: known,
          turnsTaken,
          playerHand: [...state.playerHand, ...taken],
          aiHand: state.aiHand.filter((c) => c.rank !== action.rank),
          log: push(state.log, `Dealer hands over ${taken.length} × ${RANK_LABEL[action.rank]}. Go again.`),
        })
        return s
      }

      // Go fish — the player has to click the stock to draw.
      return {
        ...state,
        knownPlayerRanks: known,
        turnsTaken,
        phase: 'playerDraw',
        pendingRank: action.rank,
        log: push(state.log, `No ${RANK_LABEL[action.rank]} — go fish. Draw a card.`),
      }
    }

    case 'DRAW': {
      if (state.phase !== 'playerDraw') return state
      if (state.stock.length === 0) {
        return { ...state, phase: 'aiTurn', pendingRank: null, log: push(state.log, 'Nothing left to fish.') }
      }
      const { state: drawnState, drawn } = drawFor(state, 'player')
      const matched = state.pendingRank != null && drawn?.rank === state.pendingRank
      const s = bookAndCheck({
        ...drawnState,
        log: push(
          drawnState.log,
          matched
            ? `You fished the ${RANK_LABEL[state.pendingRank!].replace(/s$/, '')} you asked for — go again!`
            : `You fished a ${RANK_LABEL[drawn!.rank].replace(/s$/, '')}.`,
        ),
      })
      if (s.phase === 'gameover') return s
      if (state.pendingRank != null) {
        return matched
          ? { ...s, phase: 'playerAsk', pendingRank: null }
          : { ...s, phase: 'aiTurn', pendingRank: null }
      }
      // Draw-up: keep drawing until the player has a card or the stock runs out.
      if (s.playerHand.length > 0) return { ...s, phase: 'playerAsk' }
      return s.stock.length > 0 ? { ...s, phase: 'playerDraw' } : { ...s, phase: 'aiTurn' }
    }

    case 'AI_STEP': {
      if (state.phase !== 'aiTurn') return state
      const stepped = { ...state, aiSteps: state.aiSteps + 1 }
      const ask = chooseAiAsk(state.aiHand, state.knownPlayerRanks)

      if (!ask) {
        // No cards to ask with — draw and pass.
        const { state: drawnState } = drawFor(stepped, 'ai')
        const s = bookAndCheck({ ...drawnState, log: push(drawnState.log, 'Dealer draws and passes.') })
        return s.phase === 'gameover' ? s : toPlayerTurn(s)
      }

      const taken = state.playerHand.filter((c) => c.rank === ask)
      const turnsTaken = state.turnsTaken + 1

      if (taken.length > 0) {
        const s = bookAndCheck({
          ...stepped,
          turnsTaken,
          aiHand: [...state.aiHand, ...taken],
          playerHand: state.playerHand.filter((c) => c.rank !== ask),
          log: push(state.log, `Dealer asks for ${RANK_LABEL[ask]} — you hand over ${taken.length}.`),
        })
        return s // stays aiTurn -> the container steps the AI again
      }

      const { state: drawnState, drawn } = drawFor(
        { ...stepped, turnsTaken, log: push(state.log, `Dealer asks for ${RANK_LABEL[ask]}. Go fish.`) },
        'ai',
      )
      const gotIt = drawn?.rank === ask
      const s = bookAndCheck(drawnState)
      if (s.phase === 'gameover') return s
      return gotIt ? { ...s, phase: 'aiTurn' } : toPlayerTurn(s)
    }

    case 'RESET':
      return initGoFish()

    default:
      return state
  }
}
