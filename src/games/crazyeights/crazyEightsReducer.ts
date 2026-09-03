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
  /** The player has drawn at least once this turn and may now pass. */
  drewThisTurn: boolean
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
    drewThisTurn: false,
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

      if (playerHand.length === 0) {
        return {
          ...state,
          playerHand,
          discard,
          phase: 'gameover',
          winner: 'player',
          log: push(state.log, `You played ${cardLabel(card)} and went out — you win!`),
        }
      }
      if (card.rank === '8') {
        return {
          ...state,
          playerHand,
          discard,
          phase: 'awaitSuit',
          log: push(state.log, `You played an 8 — name a suit.`),
        }
      }
      return {
        ...state,
        playerHand,
        discard,
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
        log: push(state.log, 'You drew a card.'),
      }
    }

    case 'PASS': {
      if (state.phase !== 'playerTurn' || !state.drewThisTurn) return state
      return { ...state, phase: 'aiTurn', drewThisTurn: false, log: push(state.log, 'You pass.') }
    }

    case 'AI_STEP': {
      if (state.phase !== 'aiTurn') return state
      const stepped = { ...state, aiSteps: state.aiSteps + 1 }
      const play = chooseAiPlay(state.aiHand, topCard(state), state.activeSuit)

      if (play) {
        const aiHand = state.aiHand.filter((c) => c !== play.card)
        const discard = [...state.discard, play.card]
        if (aiHand.length === 0) {
          return {
            ...stepped,
            aiHand,
            discard,
            phase: 'gameover',
            winner: 'ai',
            log: push(state.log, `AI played ${cardLabel(play.card)} and went out — you lose.`),
          }
        }
        const wildNote = play.card.rank === '8' ? ` and named ${SUIT_TITLE[play.suit!]}` : ''
        return {
          ...stepped,
          aiHand,
          discard,
          activeSuit: play.card.rank === '8' ? play.suit! : play.card.suit,
          phase: 'playerTurn',
          drewThisTurn: false,
          log: push(state.log, `AI played ${cardLabel(play.card)}${wildNote}.`),
        }
      }

      // No play — draw one, or pass if the deck is truly exhausted.
      const { stock, discard } = replenish(state.stock, state.discard)
      if (stock.length === 0) {
        return {
          ...stepped,
          phase: 'playerTurn',
          drewThisTurn: false,
          log: push(state.log, 'AI has no move — passes.'),
        }
      }
      const [drawn, ...rest] = stock
      return {
        ...stepped,
        stock: rest,
        discard,
        aiHand: [...state.aiHand, drawn],
        log: push(state.log, 'AI drew a card.'),
      }
    }

    default:
      return state
  }
}
