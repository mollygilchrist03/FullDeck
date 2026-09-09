import type { Card, Suit } from '../../types/card.js'
import { shuffle } from '../../lib/shuffle.js'
import { chooseAiPlay, isPlayable, playableCards } from './crazyEightsLogic.js'

export const HAND_SIZE = 7

export type CrazyEightsPhase = 'turn' | 'awaitSuit' | 'gameover'

export interface CrazyEightsState {
  /** Draw pile, index 0 = top. */
  stock: Card[]
  /** Discard pile, last element = top / card in play. */
  discard: Card[]
  /** One hand per seat. */
  hands: Card[][]
  /** Suit currently in force (differs from the top card's suit after an 8). */
  activeSuit: Suit
  phase: CrazyEightsPhase
  /** Seat index whose turn it is — meaningful only in phase 'turn'. */
  turn: number
  /** Seat index whose 8 is awaiting a suit choice. */
  wildSeat: number | null
  winner: number | null
  /** True when the game ended with no hand empty (a locked-up deck). */
  stalemate: boolean
  /** Consecutive passes with no card played or drawn — a full lap (every
   * seat passing once with nothing intervening) ends the game. */
  passStreak: number
  /** Increments on every AI_STEP — drives the container's "keep stepping" effect. */
  aiSteps: number
  /** Newest-last feed of what just happened. */
  log: string[]
}

export type CrazyEightsAction =
  | {
      type: 'START'
      stock: Card[]
      discard: Card[]
      hands: Card[][]
      activeSuit: Suit
    }
  | { type: 'PLAY'; index: number; seat?: number }
  | { type: 'CHOOSE_SUIT'; suit: Suit; seat?: number }
  | { type: 'DRAW'; seat?: number }
  | { type: 'PASS'; seat?: number }
  | { type: 'AI_STEP' }

const RANK_SHORT: Record<Card['rank'], string> = {
  ACE: 'A',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  JACK: 'J',
  QUEEN: 'Q',
  KING: 'K',
}
const SUIT_TITLE: Record<Suit, string> = {
  HEARTS: 'Hearts',
  DIAMONDS: 'Diamonds',
  CLUBS: 'Clubs',
  SPADES: 'Spades',
}
export const cardLabel = (c: Card): string => `${RANK_SHORT[c.rank]}${SUIT_TITLE[c.suit][0]}`

export const topCard = (s: CrazyEightsState): Card => s.discard[s.discard.length - 1]

const nextSeat = (seatCount: number, from: number): number => (from + 1) % seatCount

export function initCrazyEights(seatCount: number): CrazyEightsState {
  return {
    stock: [],
    discard: [],
    hands: Array.from({ length: seatCount }, () => []),
    activeSuit: 'SPADES',
    phase: 'turn',
    turn: 0,
    wildSeat: null,
    winner: null,
    stalemate: false,
    passStreak: 0,
    aiSteps: 0,
    log: [],
  }
}

/** Whether `seat` has a legal card to play right now. */
export function seatHasMove(s: CrazyEightsState, seat: number): boolean {
  return s.discard.length > 0 && playableCards(s.hands[seat], topCard(s), s.activeSuit).length > 0
}

/** Whether there is anything left to draw (stock, or a recyclable discard pile). */
export function canDraw(s: CrazyEightsState): boolean {
  return s.stock.length > 0 || s.discard.length > 1
}

const push = (log: string[], line: string): string[] => [...log, line].slice(-6)

/** If the stock is empty, recycle the discard pile (all but its top) into it. */
function replenish(stock: Card[], discard: Card[]): { stock: Card[]; discard: Card[] } {
  if (stock.length > 0 || discard.length <= 1) return { stock, discard }
  const top = discard[discard.length - 1]
  return { stock: shuffle(discard.slice(0, -1)), discard: [top] }
}

/** A full lap of passes and nobody can move — fewest cards wins, the lowest
 * seat index takes a tie. */
function stalemateEnd(state: CrazyEightsState, base: CrazyEightsState): CrazyEightsState {
  const lengths = state.hands.map((h) => h.length)
  const fewest = Math.min(...lengths)
  const winner = lengths.findIndex((n) => n === fewest)
  return {
    ...base,
    phase: 'gameover',
    winner,
    stalemate: true,
    log: push(state.log, `Deadlock — nobody can move. Fewest cards wins.`),
  }
}

function playCard(state: CrazyEightsState, seat: number, index: number): CrazyEightsState {
  if (state.phase !== 'turn' || state.turn !== seat) return state
  const card = state.hands[seat][index]
  if (!card || !isPlayable(card, topCard(state), state.activeSuit)) return state

  const newHand = state.hands[seat].filter((_, i) => i !== index)
  const hands = state.hands.map((h, i) => (i === seat ? newHand : h))
  const discard = [...state.discard, card]
  const base = { ...state, hands, discard, passStreak: 0 }

  if (newHand.length === 0) {
    return {
      ...base,
      phase: 'gameover',
      winner: seat,
      log: push(state.log, `Seat ${seat + 1} played ${cardLabel(card)} and went out.`),
    }
  }
  if (card.rank === '8') {
    return {
      ...base,
      phase: 'awaitSuit',
      wildSeat: seat,
      log: push(state.log, `Seat ${seat + 1} played an 8 — naming a suit.`),
    }
  }
  return {
    ...base,
    activeSuit: card.suit,
    turn: nextSeat(state.hands.length, seat),
    log: push(state.log, `Seat ${seat + 1} played ${cardLabel(card)}.`),
  }
}

function drawCard(state: CrazyEightsState, seat: number): CrazyEightsState {
  if (state.phase !== 'turn' || state.turn !== seat) return state
  if (seatHasMove(state, seat)) return state // Bicycle: only draw with no legal play
  const { stock, discard } = replenish(state.stock, state.discard)
  if (stock.length === 0) return state
  const [drawn, ...rest] = stock
  const hands = state.hands.map((h, i) => (i === seat ? [...h, drawn] : h))
  return {
    ...state,
    stock: rest,
    discard,
    hands,
    passStreak: 0,
    log: push(state.log, `Seat ${seat + 1} drew a card.`),
  }
}

function passTurn(state: CrazyEightsState, seat: number): CrazyEightsState {
  if (state.phase !== 'turn' || state.turn !== seat) return state
  if (seatHasMove(state, seat) || canDraw(state)) return state
  const passStreak = state.passStreak + 1
  if (passStreak >= state.hands.length) return stalemateEnd(state, state)
  return {
    ...state,
    turn: nextSeat(state.hands.length, seat),
    passStreak,
    log: push(state.log, `Seat ${seat + 1} passes — nothing to play or draw.`),
  }
}

export function crazyEightsReducer(
  state: CrazyEightsState,
  action: CrazyEightsAction,
): CrazyEightsState {
  switch (action.type) {
    case 'START':
      return {
        ...initCrazyEights(action.hands.length),
        stock: action.stock,
        discard: action.discard,
        hands: action.hands,
        activeSuit: action.activeSuit,
        phase: 'turn',
        log: ['Game on — match the suit or rank, or play an 8.'],
      }

    case 'PLAY':
      return playCard(state, action.seat ?? 0, action.index)

    case 'DRAW':
      return drawCard(state, action.seat ?? 0)

    case 'PASS':
      return passTurn(state, action.seat ?? 0)

    case 'CHOOSE_SUIT': {
      if (state.phase !== 'awaitSuit' || state.wildSeat === null) return state
      const seat = action.seat ?? state.wildSeat
      if (seat !== state.wildSeat) return state
      return {
        ...state,
        activeSuit: action.suit,
        phase: 'turn',
        turn: nextSeat(state.hands.length, seat),
        wildSeat: null,
        passStreak: 0,
        log: push(state.log, `Suit is now ${SUIT_TITLE[action.suit]}.`),
      }
    }

    case 'AI_STEP': {
      if (state.phase !== 'turn') return state
      const seat = state.turn
      const stepped = { ...state, aiSteps: state.aiSteps + 1 }
      const play = chooseAiPlay(state.hands[seat], topCard(state), state.activeSuit)

      if (play) {
        const idx = state.hands[seat].findIndex((c) => c.code === play.card.code)
        const played = playCard(stepped, seat, idx)
        if (play.card.rank === '8' && played.phase === 'awaitSuit') {
          return crazyEightsReducer(played, { type: 'CHOOSE_SUIT', suit: play.suit!, seat })
        }
        return played
      }

      const { stock } = replenish(state.stock, state.discard)
      if (stock.length === 0) return passTurn(stepped, seat)
      return drawCard(stepped, seat)
    }

    default:
      return state
  }
}
