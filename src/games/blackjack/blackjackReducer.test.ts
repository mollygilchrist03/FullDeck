import { describe, expect, it } from 'vitest'
import {
  blackjackReducer,
  canDouble,
  canSplit,
  committed,
  initBlackjack,
  type BlackjackState,
} from './blackjackReducer'
import { card, hand } from '../../test/helpers'

const bet = (amount: number): BlackjackState =>
  blackjackReducer(initBlackjack(), { type: 'SET_BET', amount })

const deal = (playerCards = hand('10', '9'), dealerCards = hand('7', '6')): BlackjackState =>
  blackjackReducer(bet(20), { type: 'DEAL', playerCards, dealerCards })

describe('SET_BET / DEAL', () => {
  it('clamps the bet to the bank', () => {
    expect(blackjackReducer(initBlackjack(), { type: 'SET_BET', amount: 999 }).baseBet).toBe(100)
  })

  it('deals one hand at the base bet and moves to the player turn', () => {
    const s = deal()
    expect(s.phase).toBe('player')
    expect(s.hands).toHaveLength(1)
    expect(s.hands[0].bet).toBe(20)
    expect(committed(s)).toBe(20)
  })

  it('offers insurance when the dealer shows an ace', () => {
    expect(deal(hand('10', '9'), hand('ACE', '6')).phase).toBe('insurance')
  })

  it('settles immediately on a dealer blackjack with a ten up', () => {
    const s = deal(hand('10', '9'), hand('KING', 'ACE'))
    expect(s.phase).toBe('settled')
    expect(s.hands[0].result).toBe('loss')
  })

  it('pays a player natural immediately', () => {
    const s = deal(hand('ACE', 'KING'), hand('7', '6'))
    expect(s.phase).toBe('settled')
    expect(s.hands[0].result).toBe('blackjack')
    expect(s.netPayout).toBe(30) // 20 * 1.5
  })
})

describe('insurance', () => {
  it('pays 2:1 and settles when the dealer has blackjack', () => {
    let s = deal(hand('10', '9'), hand('ACE', 'KING'))
    expect(s.phase).toBe('insurance')
    s = blackjackReducer(s, { type: 'TAKE_INSURANCE' })
    expect(s.phase).toBe('settled')
    expect(s.insuranceResult).toBe('won')
    // hand loses 20, insurance (10) pays +20 -> net 0
    expect(s.netPayout).toBe(0)
  })

  it('loses the side bet and plays on when the dealer has no blackjack', () => {
    let s = deal(hand('10', '9'), hand('ACE', '6'))
    s = blackjackReducer(s, { type: 'TAKE_INSURANCE' })
    expect(s.phase).toBe('player')
    expect(s.insuranceBet).toBe(10)
  })

  it('declining insurance just plays on', () => {
    let s = deal(hand('10', '9'), hand('ACE', '6'))
    s = blackjackReducer(s, { type: 'DECLINE_INSURANCE' })
    expect(s.phase).toBe('player')
    expect(s.insuranceBet).toBe(0)
  })
})

describe('hit / stand / double', () => {
  it('busting the only hand goes straight to settled as a loss', () => {
    let s = deal(hand('10', '9'))
    s = blackjackReducer(s, { type: 'HIT', card: card('KING') })
    expect(s.phase).toBe('settled')
    expect(s.hands[0].result).toBe('loss')
  })

  it('standing hands off to the dealer', () => {
    const s = blackjackReducer(deal(), { type: 'STAND' })
    expect(s.phase).toBe('dealer')
  })

  it('double down doubles the bet, draws one, and ends the hand', () => {
    expect(canDouble(deal())).toBe(true)
    const s = blackjackReducer(deal(), { type: 'DOUBLE', card: card('2') })
    expect(s.hands[0].bet).toBe(40)
    expect(s.hands[0].doubled).toBe(true)
    expect(s.hands[0].cards).toHaveLength(3)
    expect(s.phase).toBe('dealer')
  })

  it('cannot double with three cards or without the chips', () => {
    const threeCards = blackjackReducer(deal(), { type: 'HIT', card: card('2') })
    expect(canDouble(threeCards)).toBe(false)
    const broke = blackjackReducer(
      { ...initBlackjack(), bank: 20, baseBet: 20 },
      { type: 'DEAL', playerCards: hand('10', '9'), dealerCards: hand('7', '6') },
    )
    expect(canDouble(broke)).toBe(false)
  })
})

describe('split', () => {
  it('splits a pair into two hands, each with its own bet', () => {
    expect(canSplit(deal(hand('8', '8')))).toBe(true)
    const s = blackjackReducer(deal(hand('8', '8')), {
      type: 'SPLIT',
      cardA: card('3'),
      cardB: card('10'),
    })
    expect(s.hands).toHaveLength(2)
    expect(s.hands[0].cards).toHaveLength(2)
    expect(s.hands[1].cards).toHaveLength(2)
    expect(committed(s)).toBe(40)
    expect(s.hands.every((h) => h.fromSplit)).toBe(true)
    expect(s.phase).toBe('player')
    expect(s.activeHand).toBe(0)
  })

  it('split aces take one card each and stand', () => {
    const s = blackjackReducer(deal(hand('ACE', 'ACE')), {
      type: 'SPLIT',
      cardA: card('9'),
      cardB: card('7'),
    })
    expect(s.hands.every((h) => h.done)).toBe(true)
    expect(s.phase).toBe('dealer')
  })

  it('will not split two non-matching cards', () => {
    expect(canSplit(deal(hand('8', '9')))).toBe(false)
  })

  it('a two-card 21 on a split hand is a win, not a blackjack', () => {
    let s = blackjackReducer(deal(hand('ACE', 'ACE')), {
      type: 'SPLIT',
      cardA: card('KING'), // A + K = 21 but from a split
      cardB: card('7'),
    })
    s = blackjackReducer(s, { type: 'DEALER_RESOLVE', dealerHand: hand('10', '9') })
    expect(s.hands[0].result).toBe('win')
    expect(s.hands[0].payout).toBe(20) // 1:1, not 3:2
  })
})

describe('settlement', () => {
  it('DEALER_RESOLVE settles every hand and moves the bank', () => {
    let s = blackjackReducer(deal(hand('10', '9'), hand('7', '6')), { type: 'STAND' })
    s = blackjackReducer(s, { type: 'DEALER_RESOLVE', dealerHand: hand('10', '7') }) // dealer 17, player 19
    expect(s.phase).toBe('settled')
    expect(s.hands[0].result).toBe('win')
    expect(s.netPayout).toBe(20)
    expect(s.bank).toBe(120)
  })

  it('NEW_HAND returns to betting keeping the bank', () => {
    let s = blackjackReducer(deal(), { type: 'STAND' })
    s = blackjackReducer(s, { type: 'DEALER_RESOLVE', dealerHand: hand('10', '9') })
    s = blackjackReducer(s, { type: 'NEW_HAND' })
    expect(s.phase).toBe('betting')
    expect(s.hands).toEqual([])
  })
})
