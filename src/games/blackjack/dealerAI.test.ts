import { describe, expect, it } from 'vitest'
import { dealerShouldHit, playDealerHand } from './dealerAI'
import { card, hand } from '../../test/helpers'
import { scoreHand } from './handScoring'
import type { Card } from '../../types/card'

describe('dealerShouldHit', () => {
  it('hits below 17', () => {
    expect(dealerShouldHit(hand('10', '6'))).toBe(true)
  })

  it('stands on a hard 17', () => {
    expect(dealerShouldHit(hand('10', '7'))).toBe(false)
  })

  it('stands on a soft 17 (S17 table)', () => {
    expect(dealerShouldHit(hand('ACE', '6'))).toBe(false)
  })

  it('stands above 17', () => {
    expect(dealerShouldHit(hand('10', '9'))).toBe(false)
  })
})

describe('playDealerHand', () => {
  it('draws from the supplied queue until reaching 17+', () => {
    const queue: Card[] = [card('5'), card('4'), card('KING')]
    const result = playDealerHand(hand('10', '2'), () => queue.shift()!)
    // 12 -> +5 = 17, stop.
    expect(scoreHand(result).total).toBe(17)
    expect(result).toHaveLength(3)
    expect(queue).toHaveLength(2)
  })

  it('does not draw when already standing', () => {
    const result = playDealerHand(hand('10', '8'), () => {
      throw new Error('should not draw')
    })
    expect(result).toHaveLength(2)
  })

  it('does not mutate the input hand', () => {
    const start = hand('2', '3')
    const queue: Card[] = [card('10'), card('10')]
    playDealerHand(start, () => queue.shift()!)
    expect(start).toHaveLength(2)
  })
})
