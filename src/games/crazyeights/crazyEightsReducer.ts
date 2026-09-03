import type { Card, Suit } from '../../types/card'
import { shuffle } from '../../lib/shuffle'
import { chooseAiPlay, isPlayable } from './crazyEightsLogic'

export const HAND_SIZE = 7

export type CrazyEightsPhase = 'playerTurn' | 'awaitSuit' | 'aiTurn' | 'gameover'

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
  winner: 'player' | 'ai' | null
  /** True when the game ended with neither hand empty (a locked-up deck). */
  stalemate: boolean
  /** The player has drawn at least once this turn and may now pass. */
  drewThisTurn: boolean
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
  | { type: 'PLAY'; index: number }
  | { type: 'CHOOSE_SUIT'; suit: Suit }
  | { type: 'DRAW' }
  | { type: 'PASS' }
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

export function initCrazyEights(): CrazyEightsState {
  return {
    stock: [],
    discard: [],
    playerHand: [],
    aiHand: [],
    activeSuit: 'SPADES',
    phase: 'playerTurn',
    winner: null,
    stalemate: false,
    drewThisTurn: false,
    passStreak: 0,
    aiSteps: 0,
    log: [],
  }
}

const push = (log: string[], line: string): string[] => [...log, line].slice(-6)

/** If the stock is empty, recycle the discard pile (all but its top) into it. */
function replenish(stock: Card[], discard: Card[]): { stock: Card[]; discard: Card[] } {
  if (stock.length > 0 || discard.length <= 1) return { stock, discard }
  const top = discard[discard.length - 1]
  return { stock: shuffle(discard.slice(0, -1)), discard: [top] }
}

/** Two passes in a row and nobody can move — fewest cards wins, player takes ties. */
function stalemateEnd(state: CrazyEightsState, base: CrazyEightsState): CrazyEightsState {
  const winner: 'player' | 'ai' =
    state.playerHand.length <= state.aiHand.length ? 'player' : 'ai'
  return {
    ...base,
    phase: 'gameover',
    winner,
    stalemate: true,
    log: push(
      state.log,
      `Deadlock — nobody can move. Fewest cards wins, so ${winner === 'player' ? 'you win' : 'the AI wins'}.`,
    ),
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

    case 'PLAY': {
      if (state.phase !== 'playerTurn') return state
      const card = state.playerHand[action.index]
      if (!card || !isPlayable(card, topCard(state), state.activeSuit)) return state

      const playerHand = state.playerHand.filter((_, i) => i !== action.index)
      const discard = [...state.discard, card]
      const base = { ...state, playerHand, discard, passStreak: 0 }

      if (playerHand.length === 0) {
        return {
          ...base,
          phase: 'gameover',
          winner: 'player',
          log: push(state.log, `You played ${cardLabel(card)} and went out — you win!`),
        }
      }
      if (card.rank === '8') {
        return { ...base, phase: 'awaitSuit', log: push(state.log, `You played an 8 — name a suit.`) }
      }
      return {
        ...base,
        activeSuit: card.suit,
        phase: 'aiTurn',
        drewThisTurn: false,
        log: push(state.log, `You played ${cardLabel(card)}.`),
      }
    }

    case 'CHOOSE_SUIT': {
      if (state.phase !== 'awaitSuit') return state
      return {
        ...state,
        activeSuit: action.suit,
        phase: 'aiTurn',
        drewThisTurn: false,
        passStreak: 0,
        log: push(state.log, `Suit is now ${SUIT_TITLE[action.suit]}.`),
      }
    }

    case 'DRAW': {
      if (state.phase !== 'playerTurn') return state
      const { stock, discard } = replenish(state.stock, state.discard)
      if (stock.length === 0) {
        return { ...state, drewThisTurn: true, log: push(state.log, 'Nothing left to draw — pass.') }
      }
      const [drawn, ...rest] = stock
      return {
        ...state,
        stock: rest,
        discard,
        playerHand: [...state.playerHand, drawn],
        drewThisTurn: true,
        passStreak: 0,
        log: push(state.log, 'You drew a card.'),
      }
    }

    case 'PASS': {
      if (state.phase !== 'playerTurn' || !state.drewThisTurn) return state
      const passStreak = state.passStreak + 1
      if (passStreak >= 2) return stalemateEnd(state, state)
      return {
        ...state,
        phase: 'aiTurn',
        drewThisTurn: false,
        passStreak,
        log: push(state.log, 'You pass.'),
      }
    }

    case 'AI_STEP': {
      if (state.phase !== 'aiTurn') return state
      const stepped = { ...state, aiSteps: state.aiSteps + 1 }
      const play = chooseAiPlay(state.aiHand, topCard(state), state.activeSuit)

      if (play) {
        const aiHand = state.aiHand.filter((c) => c.code !== play.card.code)
        const discard = [...state.discard, play.card]
        const base = { ...stepped, aiHand, discard, passStreak: 0 }
        if (aiHand.length === 0) {
          return {
            ...base,
            phase: 'gameover',
            winner: 'ai',
            log: push(state.log, `AI played ${cardLabel(play.card)} and went out — you lose.`),
          }
        }
        const wildNote = play.card.rank === '8' ? ` and named ${SUIT_TITLE[play.suit!]}` : ''
        return {
          ...base,
          activeSuit: play.card.rank === '8' ? play.suit! : play.card.suit,
          phase: 'playerTurn',
          drewThisTurn: false,
          log: push(state.log, `AI played ${cardLabel(play.card)}${wildNote}.`),
        }
      }

      // No play — draw one, or pass if the deck is truly exhausted.
      const { stock, discard } = replenish(state.stock, state.discard)
      if (stock.length === 0) {
        const passStreak = state.passStreak + 1
        if (passStreak >= 2) return stalemateEnd(state, stepped)
        return {
          ...stepped,
          phase: 'playerTurn',
          drewThisTurn: false,
          passStreak,
          log: push(state.log, 'AI has no move — passes.'),
        }
      }
      const [drawn, ...rest] = stock
      return {
        ...stepped,
        stock: rest,
        discard,
        aiHand: [...state.aiHand, drawn],
        passStreak: 0,
        log: push(state.log, 'AI drew a card.'),
      }
    }

    default:
      return state
  }
}
