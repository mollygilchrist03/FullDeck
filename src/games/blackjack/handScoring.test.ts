import { describe, expect, it } from 'vitest'
import { isBlackjack, isBust, scoreHand } from './handScoring'
import { hand } from '../../test/helpers'

describe('scoreHand', () => {
  it('adds plain number cards', () => {
    expect(scoreHand(hand('5', '9'))).toEqual({ total: 14, soft: false })
  })

  it('counts face cards as 10', () => {
    expect(scoreHand(hand('KING', 'QUEEN'))).toEqual({ total: 20, soft: false })
  })

  it('treats an ace as 11 when it fits (soft hand)', () => {
    expect(scoreHand(hand('ACE', 'KING'))).toEqual({ total: 21, soft: true })
    expect(scoreHand(hand('ACE', '6'))).toEqual({ total: 17, soft: true })
  })

  it('demotes an ace to 1 to avoid busting (hard hand)', () => {
    expect(scoreHand(hand('ACE', '6', '10'))).toEqual({ total: 17, soft: false })
    expect(scoreHand(hand('KING', 'QUEEN', 'ACE'))).toEqual({ total: 21, soft: false })
  })

  it('handles multiple aces, keeping at most one high', () => {
    expect(scoreHand(hand('ACE', 'ACE'))).toEqual({ total: 12, soft: true })
    expect(scoreHand(hand('ACE', 'ACE', '9'))).toEqual({ total: 21, soft: true })
    expect(scoreHand(hand('ACE', 'ACE', 'ACE', 'KING'))).toEqual({ total: 13, soft: false })
  })

  it('reports the busted total when nothing can save the hand', () => {
    expect(scoreHand(hand('KING', 'QUEEN', 'JACK'))).toEqual({ total: 30, soft: false })
  })
})

describe('isBust', () => {
  it('is true only above 21', () => {
    expect(isBust(hand('KING', 'QUEEN', '2'))).toBe(true)
    expect(isBust(hand('KING', 'QUEEN', 'ACE'))).toBe(false)
    expect(isBust(hand('KING', 'ACE'))).toBe(false)
  })
})

describe('isBlackjack', () => {
  it('is a two-card 21 only', () => {
    expect(isBlackjack(hand('ACE', 'KING'))).toBe(true)
    expect(isBlackjack(hand('ACE', '5', '5'))).toBe(false)
    expect(isBlackjack(hand('KING', 'QUEEN', 'ACE'))).toBe(false)
    expect(isBlackjack(hand('9', 'KING'))).toBe(false)
  })
})
