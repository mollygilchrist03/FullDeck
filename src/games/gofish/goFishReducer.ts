import type { Card, Rank } from '../../types/card'
import { chooseAiAsk, countRank, takeBooks } from './goFishLogic'

export type GoFishPhase = 'playerAsk' | 'aiTurn' | 'gameover'

export interface GoFishState {
  playerHand: Card[]
  aiHand: Card[]
  stock: Card[]
  playerBooks: Rank[]
  aiBooks: Rank[]
  phase: GoFishPhase
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

  if (playerBooks.length + aiBooks.length === 13) {
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
      return bookAndCheck(seeded)
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

      // Go fish.
      const { state: drawnState, drawn } = drawFor(
        { ...state, knownPlayerRanks: known, turnsTaken, log: push(state.log, 'Go fish!') },
        'player',
      )
      const gotWhatWeAsked = drawn?.rank === action.rank
      const s = bookAndCheck({
        ...drawnState,
        log: gotWhatWeAsked
          ? push(drawnState.log, `You fished a ${RANK_LABEL[action.rank].replace(/s$/, '')} — go again.`)
          : drawnState.log,
      })
      if (s.phase === 'gameover') return s
      return { ...s, phase: gotWhatWeAsked ? 'playerAsk' : 'aiTurn' }
    }

    case 'AI_STEP': {
      if (state.phase !== 'aiTurn') return state
      const stepped = { ...state, aiSteps: state.aiSteps + 1 }
      const ask = chooseAiAsk(state.aiHand, state.knownPlayerRanks)

      if (!ask) {
        // No cards to ask with — draw and pass.
        const { state: drawnState } = drawFor(stepped, 'ai')
        const s = bookAndCheck({ ...drawnState, log: push(drawnState.log, 'Dealer draws and passes.') })
        return s.phase === 'gameover' ? s : { ...s, phase: 'playerAsk' }
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
      return { ...s, phase: gotIt ? 'aiTurn' : 'playerAsk' }
    }

    case 'RESET':
      return initGoFish()

    default:
      return state
  }
}
