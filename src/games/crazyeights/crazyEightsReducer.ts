import type { Card, Suit } from '../../types/card'
import { shuffle } from '../../lib/shuffle.js'
import { chooseAiPlay, isPlayable, playableCards } from './crazyEightsLogic.js'

export const HAND_SIZE = 7

export type CrazyEightsPhase = 'playerTurn' | 'awaitSuit' | 'aiTurn' | 'gameover'

/** 'player' = seat 0, 'ai' = seat 1 (the AI locally, a second human in a room). */
export type Side = 'player' | 'ai'

export interface CrazyEightsState {
  /** Draw pile, index 0 = top. */
  stock: Card[]
  /** Discard pile, last element = top / card in play. */
  discard: Card[]
  playerHand: Card[]
  aiHand: Card[]
  /** Suit currently in force (differs from the top card's suit after an 8). */
  activeSuit: Suit
  phase: CrazyEightsPhase
  /** Whose 8 is awaiting a suit choice. */
  wildSide: Side | null
  winner: Side | null
  /** True when the game ended with neither hand empty (a locked-up deck). */
  stalemate: boolean
  /** Consecutive passes with no card played or drawn — two in a row ends the game. */
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
      playerHand: Card[]
      aiHand: Card[]
      activeSuit: Suit
    }
  | { type: 'PLAY'; index: number; side?: Side }
  | { type: 'CHOOSE_SUIT'; suit: Suit; side?: Side }
  | { type: 'DRAW'; side?: Side }
  | { type: 'PASS'; side?: Side }
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

const phaseFor = (side: Side): CrazyEightsPhase => (side === 'player' ? 'playerTurn' : 'aiTurn')
const otherPhase = (side: Side): CrazyEightsPhase => (side === 'player' ? 'aiTurn' : 'playerTurn')
const handOf = (s: CrazyEightsState, side: Side) => (side === 'player' ? s.playerHand : s.aiHand)
const withHand = (s: CrazyEightsState, side: Side, hand: Card[]): CrazyEightsState =>
  side === 'player' ? { ...s, playerHand: hand } : { ...s, aiHand: hand }
const nameOf = (side: Side): string => (side === 'player' ? 'You' : 'Opponent')

export function initCrazyEights(): CrazyEightsState {
  return {
    stock: [],
    discard: [],
    playerHand: [],
    aiHand: [],
    activeSuit: 'SPADES',
    phase: 'playerTurn',
    wildSide: null,
    winner: null,
    stalemate: false,
    passStreak: 0,
    aiSteps: 0,
    log: [],
  }
}

/** Whether `side` has a legal card to play right now. */
export function sideHasMove(s: CrazyEightsState, side: Side): boolean {
  return s.discard.length > 0 && playableCards(handOf(s, side), topCard(s), s.activeSuit).length > 0
}
export const playerHasMove = (s: CrazyEightsState): boolean => sideHasMove(s, 'player')

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

/** Two passes in a row and nobody can move — fewest cards wins, seat 0 takes ties. */
function stalemateEnd(state: CrazyEightsState, base: CrazyEightsState): CrazyEightsState {
  const winner: Side = state.playerHand.length <= state.aiHand.length ? 'player' : 'ai'
  return {
    ...base,
    phase: 'gameover',
    winner,
    stalemate: true,
    log: push(state.log, `Deadlock — nobody can move. Fewest cards wins.`),
  }
}

function playCard(state: CrazyEightsState, side: Side, index: number): CrazyEightsState {
  if (state.phase !== phaseFor(side)) return state
  const card = handOf(state, side)[index]
  if (!card || !isPlayable(card, topCard(state), state.activeSuit)) return state

  const hand = handOf(state, side).filter((_, i) => i !== index)
  const discard = [...state.discard, card]
  const base = { ...withHand(state, side, hand), discard, passStreak: 0 }

  if (hand.length === 0) {
    return {
      ...base,
      phase: 'gameover',
      winner: side,
      log: push(state.log, `${nameOf(side)} played ${cardLabel(card)} and went out.`),
    }
  }
  if (card.rank === '8') {
    return {
      ...base,
      phase: 'awaitSuit',
      wildSide: side,
      log: push(state.log, `${nameOf(side)} played an 8 — naming a suit.`),
    }
  }
  return {
    ...base,
    activeSuit: card.suit,
    phase: otherPhase(side),
    log: push(state.log, `${nameOf(side)} played ${cardLabel(card)}.`),
  }
}

function drawCard(state: CrazyEightsState, side: Side): CrazyEightsState {
  if (state.phase !== phaseFor(side)) return state
  if (sideHasMove(state, side)) return state // Bicycle: only draw with no legal play
  const { stock, discard } = replenish(state.stock, state.discard)
  if (stock.length === 0) return state
  const [drawn, ...rest] = stock
  return {
    ...withHand({ ...state, stock: rest, discard }, side, [...handOf(state, side), drawn]),
    passStreak: 0,
    log: push(state.log, `${nameOf(side)} drew a card.`),
  }
}

function passTurn(state: CrazyEightsState, side: Side): CrazyEightsState {
  if (state.phase !== phaseFor(side)) return state
  if (sideHasMove(state, side) || canDraw(state)) return state
  const passStreak = state.passStreak + 1
  if (passStreak >= 2) return stalemateEnd(state, state)
  return {
    ...state,
    phase: otherPhase(side),
    passStreak,
    log: push(state.log, `${nameOf(side)} passes — nothing to play or draw.`),
  }
}

export function crazyEightsReducer(
  state: CrazyEightsState,
  action: CrazyEightsAction,
): CrazyEightsState {
  switch (action.type) {
    case 'START':
      return {
        ...initCrazyEights(),
        stock: action.stock,
        discard: action.discard,
        playerHand: action.playerHand,
        aiHand: action.aiHand,
        activeSuit: action.activeSuit,
        phase: 'playerTurn',
        log: ['Game on — match the suit or rank, or play an 8.'],
      }

    case 'PLAY':
      return playCard(state, action.side ?? 'player', action.index)

    case 'DRAW':
      return drawCard(state, action.side ?? 'player')

    case 'PASS':
      return passTurn(state, action.side ?? 'player')

    case 'CHOOSE_SUIT': {
      if (state.phase !== 'awaitSuit' || !state.wildSide) return state
      const side = action.side ?? state.wildSide
      if (side !== state.wildSide) return state
      return {
        ...state,
        activeSuit: action.suit,
        phase: otherPhase(side),
        wildSide: null,
        passStreak: 0,
        log: push(state.log, `Suit is now ${SUIT_TITLE[action.suit]}.`),
      }
    }

    case 'AI_STEP': {
      if (state.phase !== 'aiTurn') return state
      const stepped = { ...state, aiSteps: state.aiSteps + 1 }
      const play = chooseAiPlay(state.aiHand, topCard(state), state.activeSuit)

      if (play) {
        const idx = state.aiHand.findIndex((c) => c.code === play.card.code)
        const played = playCard(stepped, 'ai', idx)
        if (play.card.rank === '8' && played.phase === 'awaitSuit') {
          return crazyEightsReducer(played, { type: 'CHOOSE_SUIT', suit: play.suit!, side: 'ai' })
        }
        return played
      }

      const { stock } = replenish(state.stock, state.discard)
      if (stock.length === 0) return passTurn(stepped, 'ai')
      return drawCard(stepped, 'ai')
    }

    default:
      return state
  }
}
