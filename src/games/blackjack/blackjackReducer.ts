import type { Card } from '../../types/card'
import { isBlackjack, isBust, scoreHand } from './handScoring'
import { PAYOUT_MULTIPLIER, settle, type Outcome } from './outcome'

export const STARTING_BANK = 100
export const CHIP_DENOMINATIONS = [5, 25, 100] as const

export type Phase = 'betting' | 'insurance' | 'player' | 'dealer' | 'settled'

export interface PlayerHand {
  cards: Card[]
  /** This hand's stake (doubled if the player doubled down). */
  bet: number
  doubled: boolean
  /** Formed by splitting — a two-card 21 is not a blackjack here. */
  fromSplit: boolean
  /** Player is finished with this hand (stood, doubled, busted, or 21). */
  done: boolean
  result: Outcome | null
  payout: number
}

export interface BlackjackState {
  phase: Phase
  bank: number
  /** Proposed stake while betting; each hand's `bet` is derived from it. */
  baseBet: number
  hands: PlayerHand[]
  /** Index of the hand currently being played. */
  activeHand: number
  dealerHand: Card[]
  /** Whether the dealer's second card is still face-down. */
  holeHidden: boolean
  /** Insurance stake, or 0 if not taken / not offered. */
  insuranceBet: number
  insuranceResult: 'won' | 'lost' | null
  /** Net bank change applied when everything settled. */
  netPayout: number
  /** Increments each deal — animation/render key. */
  handId: number
}

export type BlackjackAction =
  | { type: 'SET_BET'; amount: number }
  | { type: 'DEAL'; playerCards: Card[]; dealerCards: Card[] }
  | { type: 'TAKE_INSURANCE' }
  | { type: 'DECLINE_INSURANCE' }
  | { type: 'HIT'; card: Card }
  | { type: 'STAND' }
  | { type: 'DOUBLE'; card: Card }
  | { type: 'SPLIT'; cardA: Card; cardB: Card }
  | { type: 'DEALER_RESOLVE'; dealerHand: Card[] }
  | { type: 'NEW_HAND' }
  | { type: 'RESET_BANK' }

function mkHand(cards: Card[], bet: number, fromSplit: boolean): PlayerHand {
  const done = fromSplit ? scoreHand(cards).total === 21 : false
  return { cards, bet, doubled: false, fromSplit, done, result: null, payout: 0 }
}

export function initBlackjack(): BlackjackState {
  return {
    phase: 'betting',
    bank: STARTING_BANK,
    baseBet: Math.min(25, STARTING_BANK),
    hands: [],
    activeHand: 0,
    dealerHand: [],
    holeHidden: true,
    insuranceBet: 0,
    insuranceResult: null,
    netPayout: 0,
    handId: 0,
  }
}

/** Chips already committed across every hand plus insurance. */
export function committed(state: BlackjackState): number {
  return state.hands.reduce((s, h) => s + h.bet, 0) + state.insuranceBet
}

export function currentHand(state: BlackjackState): PlayerHand | undefined {
  return state.hands[state.activeHand]
}

export function canDouble(state: BlackjackState): boolean {
  const h = currentHand(state)
  return (
    state.phase === 'player' &&
    !!h &&
    !h.done &&
    h.cards.length === 2 &&
    committed(state) + h.bet <= state.bank
  )
}

export function canSplit(state: BlackjackState): boolean {
  const h = currentHand(state)
  return (
    state.phase === 'player' &&
    !!h &&
    !h.done &&
    h.cards.length === 2 &&
    h.cards[0].rank === h.cards[1].rank &&
    state.hands.length < 4 &&
    committed(state) + h.bet <= state.bank
  )
}

/** Settle every hand + insurance against the final dealer hand and move chips. */
function settleAll(state: BlackjackState, dealerHand: Card[]): BlackjackState {
  const dealerBJ = isBlackjack(dealerHand)
  const hands = state.hands.map((h) => {
    const result = settle(h.cards, dealerHand, !h.fromSplit)
    return { ...h, result, payout: Math.round(h.bet * PAYOUT_MULTIPLIER[result]), done: true }
  })
  const insurancePayout =
    state.insuranceBet > 0 ? (dealerBJ ? state.insuranceBet * 2 : -state.insuranceBet) : 0
  const netPayout = hands.reduce((s, h) => s + h.payout, 0) + insurancePayout
  return {
    ...state,
    hands,
    dealerHand,
    holeHidden: false,
    phase: 'settled',
    insuranceResult: state.insuranceBet > 0 ? (dealerBJ ? 'won' : 'lost') : null,
    netPayout,
    bank: state.bank + netPayout,
  }
}

/** Move to the next unfinished hand, or hand off to the dealer / straight to settle. */
function advance(state: BlackjackState): BlackjackState {
  let i = state.activeHand
  while (i < state.hands.length && state.hands[i].done) i += 1
  if (i < state.hands.length) return { ...state, activeHand: i }

  const anyStanding = state.hands.some((h) => !isBust(h.cards))
  if (!anyStanding) return settleAll({ ...state, holeHidden: false }, state.dealerHand)
  return { ...state, phase: 'dealer', holeHidden: false, activeHand: state.hands.length - 1 }
}

/** After insurance is decided (or on a plain deal): peek, then play or settle. */
function afterPeek(state: BlackjackState): BlackjackState {
  if (isBlackjack(state.dealerHand)) return settleAll(state, state.dealerHand)
  // Player natural with no dealer natural pays immediately; dealer doesn't draw.
  if (state.hands.length === 1 && isBlackjack(state.hands[0].cards)) {
    return settleAll(state, state.dealerHand)
  }
  return { ...state, phase: 'player' }
}

export function blackjackReducer(state: BlackjackState, action: BlackjackAction): BlackjackState {
  switch (action.type) {
    case 'SET_BET': {
      if (state.phase !== 'betting') return state
      return { ...state, baseBet: Math.max(0, Math.min(action.amount, state.bank)) }
    }

    case 'DEAL': {
      if (state.phase !== 'betting' || state.baseBet <= 0 || state.baseBet > state.bank) return state
      const base: BlackjackState = {
        ...initBlackjack(),
        bank: state.bank,
        baseBet: state.baseBet,
        handId: state.handId + 1,
        hands: [mkHand(action.playerCards, state.baseBet, false)],
        dealerHand: action.dealerCards,
        holeHidden: true,
        phase: 'player',
      }
      if (action.dealerCards[0]?.rank === 'ACE') {
        return { ...base, phase: 'insurance' }
      }
      return afterPeek(base)
    }

    case 'TAKE_INSURANCE': {
      if (state.phase !== 'insurance') return state
      const room = state.bank - committed(state)
      const bet = Math.max(0, Math.min(Math.floor(state.baseBet / 2), room))
      return afterPeek({ ...state, insuranceBet: bet, phase: 'player' })
    }

    case 'DECLINE_INSURANCE': {
      if (state.phase !== 'insurance') return state
      return afterPeek({ ...state, insuranceBet: 0, phase: 'player' })
    }

    case 'HIT': {
      if (state.phase !== 'player') return state
      const h = state.hands[state.activeHand]
      if (!h || h.done) return state
      const cards = [...h.cards, action.card]
      const done = isBust(cards) || scoreHand(cards).total === 21
      const hands = state.hands.map((x, i) => (i === state.activeHand ? { ...x, cards, done } : x))
      return advance({ ...state, hands })
    }

    case 'STAND': {
      if (state.phase !== 'player') return state
      const hands = state.hands.map((x, i) =>
        i === state.activeHand ? { ...x, done: true } : x,
      )
      return advance({ ...state, hands })
    }

    case 'DOUBLE': {
      if (!canDouble(state)) return state
      const hands = state.hands.map((x, i) =>
        i === state.activeHand
          ? { ...x, bet: x.bet * 2, doubled: true, cards: [...x.cards, action.card], done: true }
          : x,
      )
      return advance({ ...state, hands })
    }

    case 'SPLIT': {
      if (!canSplit(state)) return state
      const h = state.hands[state.activeHand]
      const handA = mkHand([h.cards[0], action.cardA], h.bet, true)
      const handB = mkHand([h.cards[1], action.cardB], h.bet, true)
      // Split aces get exactly one card each and stand automatically.
      if (h.cards[0].rank === 'ACE') {
        handA.done = true
        handB.done = true
      }
      const hands = [
        ...state.hands.slice(0, state.activeHand),
        handA,
        handB,
        ...state.hands.slice(state.activeHand + 1),
      ]
      return advance({ ...state, hands })
    }

    case 'DEALER_RESOLVE': {
      if (state.phase !== 'dealer') return state
      return settleAll(state, action.dealerHand)
    }

    case 'NEW_HAND': {
      if (state.phase !== 'settled') return state
      return {
        ...initBlackjack(),
        bank: state.bank,
        baseBet: Math.min(state.baseBet || 25, state.bank),
        handId: state.handId,
      }
    }

    case 'RESET_BANK':
      return { ...initBlackjack(), handId: state.handId }

    default:
      return state
  }
}
