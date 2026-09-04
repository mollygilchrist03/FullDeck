import type { Card } from '../../types/card'
import { firstOpenSlot, isLayoutComplete, placementFor } from './trashLogic.js'

export const START_SIZE = 10

export interface Slot {
  /** The hidden card sitting in this position until it's locked. */
  faceDown: Card
  /** The correct card once played here, or null while still face-down. */
  locked: Card | null
}

export type TrashPhase = 'playerTurn' | 'wildChoice' | 'aiTurn' | 'roundOver' | 'gameover'
export type Side = 'player' | 'ai'

export interface TrashState {
  stock: Card[]
  discard: Card[]
  playerSlots: Slot[]
  aiSlots: Slot[]
  playerSize: number
  aiSize: number
  /** Card in hand mid-placement. */
  held: Card | null
  turn: 'player' | 'ai'
  round: number
  roundWinner: 'player' | 'ai' | null
  matchWinner: 'player' | 'ai' | null
  /** Cumulative player turns — the score for a match win. */
  playerTurns: number
  aiSteps: number
  /** Consecutive turns that passed with no card drawn (dead deck). */
  stalePasses: number
  /** True in solo play — winning a round shrinks the layout for the next one.
   *  False online — the first cleared row wins outright. */
  soloLadder: boolean
  phase: TrashPhase
  log: string[]
}

export type TrashAction =
  | { type: 'START'; stock: Card[]; playerFaceDown: Card[]; aiFaceDown: Card[] }
  | { type: 'DRAW'; side?: Side; auto?: boolean }
  | { type: 'TAKE_DISCARD'; side?: Side; auto?: boolean }
  | { type: 'PLACE_WILD'; slot: number; side?: Side }
  | { type: 'AI_STEP' }
  | { type: 'NEXT_ROUND'; stock: Card[]; playerFaceDown: Card[]; aiFaceDown: Card[] }
  | { type: 'RESET' }

const push = (log: string[], line: string): string[] => [...log, line].slice(-6)
const mkSlots = (faceDown: Card[]): Slot[] => faceDown.map((c) => ({ faceDown: c, locked: null }))

export function initTrash(): TrashState {
  return {
    stock: [],
    discard: [],
    playerSlots: [],
    aiSlots: [],
    playerSize: START_SIZE,
    aiSize: START_SIZE,
    held: null,
    turn: 'player',
    round: 1,
    roundWinner: null,
    matchWinner: null,
    playerTurns: 0,
    aiSteps: 0,
    stalePasses: 0,
    soloLadder: true,
    phase: 'playerTurn',
    log: [],
  }
}

/**
 * Play the current `held` card as far as it goes for `state.turn`. Chains through
 * swapped-up cards; stops at a dead card, a filled slot, a wild that needs a
 * choice (player only), or a completed layout.
 */
function resolve(state: TrashState, auto = false): TrashState {
  let s = state
  // Safety bound — a layout can't chain more than its size.
  for (let guard = 0; guard < START_SIZE + 2; guard += 1) {
    const side = s.turn
    const slots = side === 'player' ? s.playerSlots : s.aiSlots
    const size = side === 'player' ? s.playerSize : s.aiSize
    const card = s.held
    if (!card) return s

    const where = placementFor(card, size)

    if (where === 'dead') return endTurn(s, `${label(side)} drew ${card.rank.toLowerCase()} — nothing to do.`)

    if (where === 'wild') {
      const open = firstOpenSlot(slots)
      if (open === -1) return roundWin(s, side)
      if (!auto) return { ...s, phase: 'wildChoice' }
      s = lock(s, side, open)
      continue
    }

    if (slots[where].locked) {
      return endTurn(s, `${label(side)} can't use that ${card.rank.toLowerCase()} — slot ${where + 1} is done.`)
    }
    s = lock(s, side, where)
    const filled = side === 'player' ? s.playerSlots : s.aiSlots
    if (isLayoutComplete(filled)) return roundWin(s, side)
  }
  return s
}

const label = (side: 'player' | 'ai') => (side === 'player' ? 'You' : 'Dealer')

/** Lock a slot with `held`; `held` becomes that slot's hidden card. */
function lock(state: TrashState, side: 'player' | 'ai', idx: number): TrashState {
  const slots = (side === 'player' ? state.playerSlots : state.aiSlots).map((sl, i) =>
    i === idx ? { ...sl, locked: state.held! } : sl,
  )
  const swappedUp = (side === 'player' ? state.playerSlots : state.aiSlots)[idx].faceDown
  return {
    ...state,
    playerSlots: side === 'player' ? slots : state.playerSlots,
    aiSlots: side === 'ai' ? slots : state.aiSlots,
    held: swappedUp,
    stalePasses: 0,
    log: push(state.log, `${label(side)} filled slot ${idx + 1}.`),
  }
}

const openCount = (slots: Slot[]) => slots.filter((s) => s.locked === null).length

/** Both sides passed with a dead deck — fewest open slots wins the round. */
function deadDeck(state: TrashState): TrashState {
  const side: 'player' | 'ai' =
    openCount(state.playerSlots) <= openCount(state.aiSlots) ? 'player' : 'ai'
  return roundWin(
    { ...state, turn: side, log: push(state.log, 'The deck is exhausted for both sides.') },
    side,
  )
}

function endTurn(state: TrashState, message: string, forced = false): TrashState {
  const stalePasses = forced ? state.stalePasses + 1 : 0
  if (forced && stalePasses >= 2) return deadDeck(state)
  const discard = state.held ? [...state.discard, state.held] : state.discard
  const nextTurn = state.turn === 'player' ? 'ai' : 'player'
  return {
    ...state,
    held: null,
    discard,
    stalePasses,
    turn: nextTurn,
    phase: nextTurn === 'player' ? 'playerTurn' : 'aiTurn',
    playerTurns: state.turn === 'player' ? state.playerTurns + 1 : state.playerTurns,
    log: push(state.log, message),
  }
}

function roundWin(state: TrashState, side: 'player' | 'ai'): TrashState {
  const winnerSize = side === 'player' ? state.playerSize : state.aiSize
  const playerTurns = state.turn === 'player' ? state.playerTurns + 1 : state.playerTurns
  if (winnerSize === 1 || !state.soloLadder) {
    return {
      ...state,
      held: null,
      playerTurns,
      matchWinner: side,
      phase: 'gameover',
      log: push(
        state.log,
        state.soloLadder
          ? `${label(side)} completed a single-card layout — ${label(side)} win the match!`
          : `${label(side)} cleared the row — ${label(side)} win!`,
      ),
    }
  }
  return {
    ...state,
    held: null,
    playerTurns,
    roundWinner: side,
    phase: 'roundOver',
    log: push(state.log, `${label(side)} cleared the layout. ${label(side)} deal one fewer card next round.`),
  }
}

function drawInto(state: TrashState, source: 'stock' | 'discard', auto = false): TrashState {
  if (source === 'discard') {
    if (state.discard.length === 0) return state
    const held = state.discard[state.discard.length - 1]
    return resolve({ ...state, held, discard: state.discard.slice(0, -1) }, auto)
  }
  if (state.stock.length === 0) {
    // Recycle the discard (minus its top) into the stock.
    if (state.discard.length <= 1) return endTurn(state, 'Deck exhausted — turn passes.', true)
    const top = state.discard[state.discard.length - 1]
    return drawInto(
      { ...state, stock: shuffle(state.discard.slice(0, -1)), discard: [top] },
      'stock',
      auto,
    )
  }
  const [held, ...stock] = state.stock
  return resolve({ ...state, held, stock }, auto)
}

function shuffle(cards: Card[]): Card[] {
  const out = [...cards]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function trashReducer(state: TrashState, action: TrashAction): TrashState {
  switch (action.type) {
    case 'START':
      return {
        ...initTrash(),
        stock: action.stock,
        playerSlots: mkSlots(action.playerFaceDown),
        aiSlots: mkSlots(action.aiFaceDown),
        playerSize: action.playerFaceDown.length,
        aiSize: action.aiFaceDown.length,
        log: ['Draw a card and slot it into its position (Ace = 1). Queens are wild.'],
      }

    case 'DRAW': {
      const side = action.side ?? 'player'
      const want = side === 'player' ? 'playerTurn' : 'aiTurn'
      if (state.phase !== want || state.turn !== side) return state
      return drawInto(state, 'stock', action.auto ?? false)
    }

    case 'TAKE_DISCARD': {
      const side = action.side ?? 'player'
      const want = side === 'player' ? 'playerTurn' : 'aiTurn'
      if (state.phase !== want || state.turn !== side || state.discard.length === 0) return state
      return drawInto(state, 'discard', action.auto ?? false)
    }

    case 'PLACE_WILD': {
      const side = action.side ?? 'player'
      if (state.phase !== 'wildChoice' || state.turn !== side) return state
      const slots = side === 'player' ? state.playerSlots : state.aiSlots
      if (action.slot < 0 || action.slot >= slots.length || slots[action.slot].locked) return state
      const back = side === 'player' ? 'playerTurn' : 'aiTurn'
      const locked = lock({ ...state, phase: back }, side, action.slot)
      const filled = side === 'player' ? locked.playerSlots : locked.aiSlots
      return resolve(isLayoutComplete(filled) ? roundWin(locked, side) : locked)
    }

    case 'AI_STEP': {
      if (state.phase !== 'aiTurn') return state
      const stepped = { ...state, aiSteps: state.aiSteps + 1 }
      // Take the discard if it's immediately useful, otherwise draw.
      const top = state.discard[state.discard.length - 1]
      const useful =
        top &&
        (() => {
          const w = placementFor(top, state.aiSize)
          return w === 'wild' || (typeof w === 'number' && !state.aiSlots[w].locked)
        })()
      return drawInto(stepped, useful ? 'discard' : 'stock', true)
    }

    case 'NEXT_ROUND': {
      if (state.phase !== 'roundOver' || !state.roundWinner) return state
      const winner = state.roundWinner
      const playerSize = winner === 'player' ? state.playerSize - 1 : state.playerSize
      const aiSize = winner === 'ai' ? state.aiSize - 1 : state.aiSize
      // The round loser leads the next one.
      const turn: 'player' | 'ai' = winner === 'player' ? 'ai' : 'player'
      return {
        ...initTrash(),
        round: state.round + 1,
        playerTurns: state.playerTurns,
        stock: action.stock,
        playerSlots: mkSlots(action.playerFaceDown),
        aiSlots: mkSlots(action.aiFaceDown),
        playerSize,
        aiSize,
        turn,
        phase: turn === 'player' ? 'playerTurn' : 'aiTurn',
        log: [`Round ${state.round + 1}. You lay ${playerSize}, the dealer lays ${aiSize}.`],
      }
    }

    case 'RESET':
      return initTrash()

    default:
      return state
  }
}
