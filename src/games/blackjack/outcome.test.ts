import { describe, expect, it } from 'vitest'
import { PAYOUT_MULTIPLIER, settle } from './outcome'
import { hand } from '../../test/helpers'

describe('settle', () => {
  it('player blackjack beats a non-natural 21', () => {
    expect(settle(hand('ACE', 'KING'), hand('7', '7', '7'))).toBe('blackjack')
  })

  it('two naturals push', () => {
    expect(settle(hand('ACE', 'KING'), hand('ACE', 'QUEEN'))).toBe('push')
  })

  it('dealer natural beats a normal player hand', () => {
    expect(settle(hand('10', '9'), hand('ACE', 'KING'))).toBe('loss')
  })

  it('player bust always loses, even if the dealer also busts', () => {
    expect(settle(hand('10', '9', '5'), hand('10', '9', '8'))).toBe('loss')
  })

  it('dealer bust wins for a standing player', () => {
    expect(settle(hand('10', '8'), hand('10', '6', '9'))).toBe('win')
  })

  it('higher total wins', () => {
    expect(settle(hand('10', '9'), hand('10', '8'))).toBe('win')
    expect(settle(hand('10', '7'), hand('10', '9'))).toBe('loss')
  })

  it('equal totals push', () => {
    expect(settle(hand('10', '8'), hand('10', '8'))).toBe('push')
  })

  it('with playerNatural=false, a two-card 21 is an ordinary hand', () => {
    // Split-hand 21 vs a dealer natural -> loss, not push.
    expect(settle(hand('ACE', 'KING'), hand('ACE', 'QUEEN'), false)).toBe('loss')
    // vs a dealer 20 -> just a win.
    expect(settle(hand('ACE', 'KING'), hand('10', 'QUEEN'), false)).toBe('win')
  })
})

describe('PAYOUT_MULTIPLIER', () => {
  it('pays 3:2 on blackjack and 1:1 on a win', () => {
    expect(PAYOUT_MULTIPLIER.blackjack).toBe(1.5)
    expect(PAYOUT_MULTIPLIER.win).toBe(1)
    expect(PAYOUT_MULTIPLIER.push).toBe(0)
    expect(PAYOUT_MULTIPLIER.loss).toBe(-1)
  })
})
