import type { Card } from '../../types/card.js'
import { firstOpenSlot, isLayoutComplete, placementFor } from './trashLogic.js'

export const START_SIZE = 10

export interface Slot {
  /** The hidden card sitting in this position until it's locked. */
  faceDown: Card
  /** The correct card once played here, or null while still face-down. */
  locked: Card | null
}

export type TrashPhase = 'turn' | 'wildChoice' | 'roundOver' | 'gameover'

export interface TrashState {
  stock: Card[]
  discard: Card[]
  /** One row per seat. */
  slots: Slot[][]
  /** One row size per seat — shrinks for the round winner in solo-ladder play. */
  sizes: number[]
  /** Card in hand mid-placement. */
  held: Card | null
  /** Seat index whose turn it is. */
  turn: number
  round: number
  roundWinner: number | null
  matchWinner: number | null
  /** Cumulative seat-0 turns — the score for a solo match win. */
  turnsTaken: number
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
  | { type: 'START'; stock: Card[]; faceDown: Card[][] }
  | { type: 'DRAW'; seat?: number; auto?: boolean }
  | { type: 'TAKE_DISCARD'; seat?: number; auto?: boolean }
  | { type: 'PLACE_WILD'; slot: number; seat?: number }
  | { type: 'AI_STEP' }
  | { type: 'NEXT_ROUND'; stock: Card[]; faceDown: Card[][] }
  | { type: 'RESET' }

const push = (log: string[], line: string): string[] => [...log, line].slice(-6)
const mkSlots = (faceDown: Card[]): Slot[] => faceDown.map((c) => ({ faceDown: c, locked: null }))

export function initTrash(seatCount: number): TrashState {
  return {
    stock: [],
    discard: [],
    slots: Array.from({ length: seatCount }, () => []),
    sizes: Array.from({ length: seatCount }, () => START_SIZE),
    held: null,
    turn: 0,
    round: 1,
    roundWinner: null,
    matchWinner: null,
    turnsTaken: 0,
    aiSteps: 0,
    stalePasses: 0,
    soloLadder: true,
    phase: 'turn',
    log: [],
  }
}

/**
 * Play the current `held` card as far as it goes for `state.turn`. Chains through
 * swapped-up cards; stops at a dead card, a filled slot, a wild that needs a
 * choice (a human seat only), or a completed layout.
 */
function resolve(state: TrashState, auto = false, progressedAlready = false): TrashState {
  let s = state
  let progressed = progressedAlready
  // Safety bound — a layout can't chain more than its size.
  for (let guard = 0; guard < START_SIZE + 2; guard += 1) {
    const seat = s.turn
    const slots = s.slots[seat]
    const size = s.sizes[seat]
    const card = s.held
    if (!card) return s

    const where = placementFor(card, size)

    if (where === 'dead') {
      return endTurn(s, `Seat ${seat + 1} drew ${card.rank.toLowerCase()} — nothing to do.`, progressed)
    }

    if (where === 'wild') {
      const open = firstOpenSlot(slots)
      if (open === -1) return roundWin(s, seat)
      if (!auto) return { ...s, phase: 'wildChoice' }
      s = lock(s, seat, open)
      progressed = true
      continue
    }

    if (slots[where].locked) {
      return endTurn(s, `Seat ${seat + 1} can't use that ${card.rank.toLowerCase()} — slot ${where + 1} is done.`, progressed)
    }
    s = lock(s, seat, where)
    progressed = true
    if (isLayoutComplete(s.slots[seat])) return roundWin(s, seat)
  }
  return s
}

/** Lock a slot with `held`; `held` becomes that slot's hidden card. */
function lock(state: TrashState, seat: number, idx: number): TrashState {
  const row = state.slots[seat].map((sl, i) => (i === idx ? { ...sl, locked: state.held! } : sl))
  const swappedUp = state.slots[seat][idx].faceDown
  return {
    ...state,
    slots: state.slots.map((r, i) => (i === seat ? row : r)),
    held: swappedUp,
    stalePasses: 0,
    log: push(state.log, `Seat ${seat + 1} filled slot ${idx + 1}.`),
  }
}

const openCount = (slots: Slot[]) => slots.filter((s) => s.locked === null).length

/** Every seat passed with a dead deck — fewest open slots wins the round,
 * lowest seat index breaking a tie. */
function deadDeck(state: TrashState): TrashState {
  const opens = state.slots.map(openCount)
  const fewest = Math.min(...opens)
  const seat = opens.findIndex((o) => o === fewest)
  return roundWin(
    { ...state, turn: seat, log: push(state.log, 'The deck is exhausted for everyone.') },
    seat,
  )
}

/** `progressed` is whether this turn locked any slot at all — a card can
 * always be *drawn* as long as the deck has cards left, but with more seats
 * sharing one deck, "drawable" and "useful to whoever's turn it is" are very
 * different: a turn can succeed at drawing a card every time and still make
 * zero progress toward anyone's layout, forever. `stalePasses` has to track
 * *that*, not just "stock and discard both ran dry" — the narrower check was
 * fine when 2 seats made "nothing to draw" and "no progress possible" the
 * same thing, but they aren't the same thing once more seats are sharing
 * the deck. */
function endTurn(state: TrashState, message: string, progressed: boolean): TrashState {
  const stalePasses = progressed ? 0 : state.stalePasses + 1
  const n = state.slots.length
  if (stalePasses >= n) return deadDeck(state)
  const discard = state.held ? [...state.discard, state.held] : state.discard
  const nextTurn = (state.turn + 1) % n
  return {
    ...state,
    held: null,
    discard,
    stalePasses,
    turn: nextTurn,
    phase: 'turn',
    turnsTaken: state.turn === 0 ? state.turnsTaken + 1 : state.turnsTaken,
    log: push(state.log, message),
  }
}

function roundWin(state: TrashState, seat: number): TrashState {
  const winnerSize = state.sizes[seat]
  const turnsTaken = state.turn === 0 ? state.turnsTaken + 1 : state.turnsTaken
  // The layout can complete (or a wild find no open slot) while a
  // just-swapped-up card is still sitting in `held`, never placed anywhere
  // — fold it into the discard pile instead of letting it vanish.
  const discard = state.held ? [...state.discard, state.held] : state.discard
  if (winnerSize === 1 || !state.soloLadder) {
    return {
      ...state,
      held: null,
      discard,
      turnsTaken,
      matchWinner: seat,
      phase: 'gameover',
      log: push(
        state.log,
        state.soloLadder
          ? `Seat ${seat + 1} completed a single-card layout — Seat ${seat + 1} wins the match!`
          : `Seat ${seat + 1} cleared the row — Seat ${seat + 1} wins!`,
      ),
    }
  }
  return {
    ...state,
    held: null,
    discard,
    turnsTaken,
    roundWinner: seat,
    phase: 'roundOver',
    log: push(state.log, `Seat ${seat + 1} cleared the layout. Seat ${seat + 1} deals one fewer card next round.`),
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
    if (state.discard.length <= 1) return endTurn(state, 'Deck exhausted — turn passes.', false)
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
        ...initTrash(action.faceDown.length),
        stock: action.stock,
        slots: action.faceDown.map(mkSlots),
        sizes: action.faceDown.map((fd) => fd.length),
        log: ['Draw a card and slot it into its position (Ace = 1). Queens are wild.'],
      }

    case 'DRAW': {
      const seat = action.seat ?? 0
      if (state.phase !== 'turn' || state.turn !== seat) return state
      return drawInto(state, 'stock', action.auto ?? false)
    }

    case 'TAKE_DISCARD': {
      const seat = action.seat ?? 0
      if (state.phase !== 'turn' || state.turn !== seat || state.discard.length === 0) return state
      return drawInto(state, 'discard', action.auto ?? false)
    }

    case 'PLACE_WILD': {
      const seat = action.seat ?? 0
      if (state.phase !== 'wildChoice' || state.turn !== seat) return state
      const slots = state.slots[seat]
      if (action.slot < 0 || action.slot >= slots.length || slots[action.slot].locked) return state
      const locked = lock({ ...state, phase: 'turn' }, seat, action.slot)
      return resolve(isLayoutComplete(locked.slots[seat]) ? roundWin(locked, seat) : locked, false, true)
    }

    case 'AI_STEP': {
      // Solo-only: seat 1 is always the AI.
      if (state.phase !== 'turn' || state.turn !== 1) return state
      const stepped = { ...state, aiSteps: state.aiSteps + 1 }
      // Take the discard if it's immediately useful, otherwise draw.
      const top = state.discard[state.discard.length - 1]
      const useful =
        top &&
        (() => {
          const w = placementFor(top, state.sizes[1])
          return w === 'wild' || (typeof w === 'number' && !state.slots[1][w].locked)
        })()
      return drawInto(stepped, useful ? 'discard' : 'stock', true)
    }

    case 'NEXT_ROUND': {
      if (state.phase !== 'roundOver' || state.roundWinner === null) return state
      const winner = state.roundWinner
      const n = state.slots.length
      const sizes = state.sizes.map((sz, i) => (i === winner ? sz - 1 : sz))
      // The round loser(s) lead the next one — the seat after the winner.
      const turn = (winner + 1) % n
      return {
        ...initTrash(n),
        round: state.round + 1,
        turnsTaken: state.turnsTaken,
        stock: action.stock,
        slots: action.faceDown.map(mkSlots),
        sizes,
        turn,
        phase: 'turn',
        log: [`Round ${state.round + 1}.`],
      }
    }

    case 'RESET':
      return initTrash(state.slots.length)

    default:
      return state
  }
}
