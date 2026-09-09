import type { Card, Rank } from '../../types/card.js'
import { chooseAiAsk, countRank, takeBooks } from './goFishLogic.js'

export type GoFishPhase = 'ask' | 'draw' | 'gameover'

export interface GoFishState {
  /** One hand per seat. */
  hands: Card[][]
  stock: Card[]
  /** One array of completed-book ranks per seat. */
  books: Rank[][]
  phase: GoFishPhase
  /** Seat index whose turn it is. */
  turn: number
  /** During phase 'draw': the rank the asker just went fishing for (null for
   * an empty-hand draw-up, which isn't chasing any particular rank). */
  pendingRank: Rank | null
  /**
   * The solo AI's memory (seat 1 only): ranks seat 0 has *asked* for (public
   * information — you can only ask for a rank you hold). Capped to the last
   * couple of asks, and an entry is dropped once the AI has asked for it.
   * Multiplayer has no AI seat, so this is simply unused there.
   */
  knownPlayerRanks: Rank[]
  /** Increments each AI_STEP so the container can keep stepping. */
  aiSteps: number
  /** Asks seat 0 has made — the score for a solo win. */
  turnsTaken: number
  log: string[]
  winner: number | null
}

export type GoFishAction =
  | { type: 'START'; hands: Card[][]; stock: Card[] }
  | { type: 'ASK'; rank: Rank; target: number; seat?: number }
  | { type: 'DRAW'; seat?: number }
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

export function initGoFish(seatCount: number): GoFishState {
  return {
    hands: Array.from({ length: seatCount }, () => []),
    stock: [],
    books: Array.from({ length: seatCount }, () => []),
    phase: 'ask',
    turn: 0,
    pendingRank: null,
    knownPlayerRanks: [],
    aiSteps: 0,
    turnsTaken: 0,
    log: [],
    winner: null,
  }
}

function bookAndCheck(state: GoFishState): GoFishState {
  const results = state.hands.map((h) => takeBooks(h))
  const hands = results.map((r) => r.hand)
  const books = state.books.map((b, i) => [...b, ...results[i].books])
  let log = state.log
  for (let i = 0; i < results.length; i += 1) {
    for (const b of results[i].books) log = push(log, `Seat ${i + 1} completed a book of ${RANK_LABEL[b]}.`)
  }

  const next: GoFishState = {
    ...state,
    hands,
    books,
    knownPlayerRanks: state.knownPlayerRanks.filter((r) => !results[0].books.includes(r)),
    log,
  }

  const totalBooks = books.reduce((sum, b) => sum + b.length, 0)
  const allGone = next.hands.every((h) => h.length === 0) && next.stock.length === 0
  if (totalBooks === 13 || allGone) {
    const counts = books.map((b) => b.length)
    const most = Math.max(...counts)
    const winner = counts.findIndex((c) => c === most)
    return {
      ...next,
      phase: 'gameover',
      winner,
      log: push(log, `All books made — Seat ${winner + 1} wins.`),
    }
  }
  return next
}

/** Hand the turn to `seat`; draw up first if their hand is empty, or find
 * the next seat (in rotation) that can actually act if `seat` has neither
 * cards nor stock to draw from. */
function toTurn(state: GoFishState, seat: number): GoFishState {
  if (state.phase === 'gameover') return state
  const s = { ...state, pendingRank: null }
  if (s.hands[seat].length > 0) return { ...s, phase: 'ask', turn: seat }
  if (s.stock.length > 0) return { ...s, phase: 'draw', turn: seat }
  const n = s.hands.length
  for (let step = 1; step <= n; step += 1) {
    const i = (seat + step) % n
    if (s.hands[i].length > 0) return { ...s, phase: 'ask', turn: i }
  }
  return s // nobody has anything left — bookAndCheck's all-gone guard already ended it
}

function drawFor(state: GoFishState, seat: number): { state: GoFishState; drawn: Card | null } {
  if (state.stock.length === 0) return { state, drawn: null }
  const [drawn, ...stock] = state.stock
  const hands = state.hands.map((h, i) => (i === seat ? [...h, drawn] : h))
  return { state: { ...state, stock, hands }, drawn }
}

/** How many recent asks the solo AI keeps in mind. A real opponent
 * remembers the last thing or two you asked for, not every rank forever. */
const AI_MEMORY = 2

function doAsk(state: GoFishState, asker: number, rank: Rank, target: number): GoFishState {
  if (state.phase !== 'ask' || state.turn !== asker) return state
  if (target === asker || target < 0 || target >= state.hands.length) return state
  if (countRank(state.hands[asker], rank) === 0) return state

  // Seat 0's asks are public info the solo AI (seat 1) remembers; the AI
  // asking *for* a remembered rank spends that read either way.
  const known =
    asker === 0
      ? [...state.knownPlayerRanks.filter((r) => r !== rank), rank].slice(-AI_MEMORY)
      : state.knownPlayerRanks.filter((r) => r !== rank)
  const turnsTaken = asker === 0 ? state.turnsTaken + 1 : state.turnsTaken
  const taken = state.hands[target].filter((c) => c.rank === rank)

  if (taken.length > 0) {
    const hands = state.hands.map((h, i) => {
      if (i === asker) return [...h, ...taken]
      if (i === target) return h.filter((c) => c.rank !== rank)
      return h
    })
    const booked = bookAndCheck({
      ...state,
      hands,
      knownPlayerRanks: known,
      turnsTaken,
      log: push(state.log, `Seat ${target + 1} hands over ${taken.length} × ${RANK_LABEL[rank]} to Seat ${asker + 1}. Go again.`),
    })
    // "Go again" — but if that hit emptied the asker's hand (booked their
    // last rank), route through toTurn so they draw up or pass instead of
    // being stuck on an ask they can't make.
    return toTurn(booked, asker)
  }

  return {
    ...state,
    knownPlayerRanks: known,
    turnsTaken,
    phase: 'draw',
    pendingRank: rank,
    log: push(state.log, `Seat ${target + 1} has no ${RANK_LABEL[rank]} — Seat ${asker + 1} goes fish.`),
  }
}

function doDraw(state: GoFishState, drawer: number): GoFishState {
  if (state.phase !== 'draw' || state.turn !== drawer) return state
  const n = state.hands.length
  if (state.stock.length === 0) return toTurn(state, (drawer + 1) % n)

  const { state: drawnState, drawn } = drawFor(state, drawer)
  const matched = state.pendingRank != null && drawn?.rank === state.pendingRank
  const line = matched
    ? `Seat ${drawer + 1} fished what they asked for — go again.`
    : `Seat ${drawer + 1} draws a card.`
  const s = bookAndCheck({ ...drawnState, log: push(drawnState.log, line) })
  if (s.phase === 'gameover') return s

  if (state.pendingRank != null) {
    return matched ? toTurn(s, drawer) : toTurn({ ...s, pendingRank: null }, (drawer + 1) % n)
  }
  // Draw-up (empty hand, no rank pending).
  if (s.hands[drawer].length > 0) return { ...s, phase: 'ask', turn: drawer }
  return s.stock.length > 0 ? { ...s, phase: 'draw', turn: drawer } : toTurn(s, (drawer + 1) % n)
}

export function goFishReducer(state: GoFishState, action: GoFishAction): GoFishState {
  switch (action.type) {
    case 'START': {
      const seeded: GoFishState = {
        ...initGoFish(action.hands.length),
        hands: action.hands,
        stock: action.stock,
        log: ['Ask another player for a rank you already hold.'],
      }
      return toTurn(bookAndCheck(seeded), 0)
    }

    case 'ASK':
      return doAsk(state, action.seat ?? 0, action.rank, action.target)

    case 'DRAW':
      return doDraw(state, action.seat ?? 0)

    case 'AI_STEP': {
      // Solo-only: seat 1 is always the AI, always targeting seat 0.
      if (state.turn !== 1 || (state.phase !== 'ask' && state.phase !== 'draw')) return state
      const stepped = { ...state, aiSteps: state.aiSteps + 1 }
      if (stepped.phase === 'draw') return doDraw(stepped, 1)
      const ask = chooseAiAsk(state.hands[1], state.knownPlayerRanks)
      if (ask) return doAsk(stepped, 1, ask, 0)
      // No cards to ask with.
      return stepped.stock.length > 0
        ? { ...stepped, phase: 'draw', pendingRank: null }
        : toTurn(stepped, 0)
    }

    case 'RESET':
      return initGoFish(state.hands.length)

    default:
      return state
  }
}
