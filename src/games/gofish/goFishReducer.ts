import type { Card, Rank } from '../../types/card'
import { chooseAiAsk, countRank, takeBooks } from './goFishLogic.js'

export type Side = 'player' | 'ai'
export type GoFishPhase = 'playerAsk' | 'playerDraw' | 'aiAsk' | 'aiDraw' | 'gameover'

export interface GoFishState {
  playerHand: Card[]
  aiHand: Card[]
  stock: Card[]
  playerBooks: Rank[]
  aiBooks: Rank[]
  phase: GoFishPhase
  /** During a *Draw phase: the rank that side asked for (null for a draw-up). */
  pendingRank: Rank | null
  /** Ranks the player has asked for — the AI's memory. */
  knownPlayerRanks: Rank[]
  /** Increments each AI_STEP so the container can keep stepping. */
  aiSteps: number
  turnsTaken: number
  log: string[]
  winner: Side | null
}

export type GoFishAction =
  | { type: 'START'; playerHand: Card[]; aiHand: Card[]; stock: Card[] }
  | { type: 'ASK'; rank: Rank; side?: Side }
  | { type: 'DRAW'; side?: Side }
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
const other = (s: Side): Side => (s === 'player' ? 'ai' : 'player')
const handOf = (st: GoFishState, s: Side) => (s === 'player' ? st.playerHand : st.aiHand)
const withHand = (st: GoFishState, s: Side, h: Card[]): GoFishState =>
  s === 'player' ? { ...st, playerHand: h } : { ...st, aiHand: h }
const name = (s: Side) => (s === 'player' ? 'You' : 'The dealer')
const askPhase = (s: Side): GoFishPhase => (s === 'player' ? 'playerAsk' : 'aiAsk')
const drawPhase = (s: Side): GoFishPhase => (s === 'player' ? 'playerDraw' : 'aiDraw')

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
    const winner: Side = playerBooks.length >= aiBooks.length ? 'player' : 'ai'
    return {
      ...next,
      phase: 'gameover',
      winner,
      log: push(log, winner === 'player' ? 'All books made — you win!' : 'All books made — the dealer wins.'),
    }
  }
  return next
}

/** Hand the turn to `side`; draw up first if their hand is empty. */
function toTurn(state: GoFishState, side: Side): GoFishState {
  if (state.phase === 'gameover') return state
  const s = { ...state, pendingRank: null }
  if (handOf(s, side).length > 0) return { ...s, phase: askPhase(side) }
  if (s.stock.length > 0) return { ...s, phase: drawPhase(side) }
  // Empty hand, empty stock. Pass to the other side if they can still play.
  if (handOf(s, other(side)).length > 0) return { ...s, phase: askPhase(other(side)) }
  return s // bookAndCheck's all-gone guard will have ended it
}

function drawFor(state: GoFishState, side: Side): { state: GoFishState; drawn: Card | null } {
  if (state.stock.length === 0) return { state, drawn: null }
  const [drawn, ...stock] = state.stock
  return { state: withHand({ ...state, stock }, side, [...handOf(state, side), drawn]), drawn }
}

function doAsk(state: GoFishState, asker: Side, rank: Rank): GoFishState {
  if (state.phase !== askPhase(asker)) return state
  if (countRank(handOf(state, asker), rank) === 0) return state
  const opp = other(asker)
  const known =
    asker === 'player' && !state.knownPlayerRanks.includes(rank)
      ? [...state.knownPlayerRanks, rank]
      : state.knownPlayerRanks
  const turnsTaken = asker === 'player' ? state.turnsTaken + 1 : state.turnsTaken
  const taken = handOf(state, opp).filter((c) => c.rank === rank)

  if (taken.length > 0) {
    let s: GoFishState = { ...state, knownPlayerRanks: known, turnsTaken }
    s = withHand(s, asker, [...handOf(s, asker), ...taken])
    s = withHand(s, opp, handOf(s, opp).filter((c) => c.rank !== rank))
    return bookAndCheck({
      ...s,
      log: push(state.log, `${name(opp)} hands over ${taken.length} × ${RANK_LABEL[rank]}. Go again.`),
    })
  }

  return {
    ...state,
    knownPlayerRanks: known,
    turnsTaken,
    phase: drawPhase(asker),
    pendingRank: rank,
    log: push(state.log, `No ${RANK_LABEL[rank]} — ${asker === 'player' ? 'go fish. Draw a card.' : 'the dealer fishes.'}`),
  }
}

function doDraw(state: GoFishState, drawer: Side): GoFishState {
  if (state.phase !== drawPhase(drawer)) return state
  if (state.stock.length === 0) return toTurn(state, other(drawer))

  const { state: drawnState, drawn } = drawFor(state, drawer)
  const matched = state.pendingRank != null && drawn?.rank === state.pendingRank
  const s = bookAndCheck({
    ...drawnState,
    log: push(
      drawnState.log,
      matched
        ? `${name(drawer)} fished the ${RANK_LABEL[state.pendingRank!].replace(/s$/, '')} — go again!`
        : `${name(drawer)} fished a ${RANK_LABEL[drawn!.rank].replace(/s$/, '')}.`,
    ),
  })
  if (s.phase === 'gameover') return s

  if (state.pendingRank != null) {
    return matched
      ? { ...s, phase: askPhase(drawer), pendingRank: null }
      : toTurn({ ...s, pendingRank: null }, other(drawer))
  }
  // Draw-up.
  if (handOf(s, drawer).length > 0) return { ...s, phase: askPhase(drawer) }
  return s.stock.length > 0 ? { ...s, phase: drawPhase(drawer) } : toTurn(s, other(drawer))
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
      return toTurn(bookAndCheck(seeded), 'player')
    }

    case 'ASK':
      return doAsk(state, action.side ?? 'player', action.rank)

    case 'DRAW':
      return doDraw(state, action.side ?? 'player')

    case 'AI_STEP': {
      if (state.phase !== 'aiAsk' && state.phase !== 'aiDraw') return state
      const stepped = { ...state, aiSteps: state.aiSteps + 1 }
      if (stepped.phase === 'aiDraw') return doDraw(stepped, 'ai')
      const ask = chooseAiAsk(state.aiHand, state.knownPlayerRanks)
      if (ask) return doAsk(stepped, 'ai', ask)
      // No cards to ask with.
      return stepped.stock.length > 0
        ? { ...stepped, phase: 'aiDraw', pendingRank: null }
        : toTurn(stepped, 'player')
    }

    case 'RESET':
      return initGoFish()

    default:
      return state
  }
}
