import { describe, expect, it } from 'vitest'
import { evaluateHand } from './pokerHand'
import { payout } from './paytable'
import {
  drawSlots,
  initVideoPoker,
  videoPokerReducer,
  type VideoPokerState,
} from './videoPokerReducer'
import { card } from '../../test/helpers'
import type { Card } from '../../types/card'
import type { Rank, Suit } from '../../types/card'

const h = (...specs: [Rank, Suit][]): Card[] => specs.map(([r, s]) => card(r, s))
const H = 'HEARTS' as const
const S = 'SPADES' as const
const D = 'DIAMONDS' as const
const C = 'CLUBS' as const

describe('evaluateHand', () => {
  it('royal flush', () => {
    expect(evaluateHand(h(['10', H], ['JACK', H], ['QUEEN', H], ['KING', H], ['ACE', H]))).toBe(
      'royal-flush',
    )
  })

  it('straight flush (king-high)', () => {
    expect(evaluateHand(h(['9', S], ['10', S], ['JACK', S], ['QUEEN', S], ['KING', S]))).toBe(
      'straight-flush',
    )
  })

  it('straight flush on the A-2-3-4-5 wheel', () => {
    expect(evaluateHand(h(['ACE', C], ['2', C], ['3', C], ['4', C], ['5', C]))).toBe(
      'straight-flush',
    )
  })

  it('four of a kind', () => {
    expect(evaluateHand(h(['7', H], ['7', S], ['7', D], ['7', C], ['KING', H]))).toBe(
      'four-of-a-kind',
    )
  })

  it('full house', () => {
    expect(evaluateHand(h(['4', H], ['4', S], ['4', D], ['9', C], ['9', H]))).toBe('full-house')
  })

  it('flush', () => {
    expect(evaluateHand(h(['2', D], ['5', D], ['9', D], ['JACK', D], ['KING', D]))).toBe('flush')
  })

  it('ace-high straight, mixed suits', () => {
    expect(evaluateHand(h(['10', H], ['JACK', S], ['QUEEN', D], ['KING', C], ['ACE', H]))).toBe(
      'straight',
    )
  })

  it('wheel straight, mixed suits', () => {
    expect(evaluateHand(h(['ACE', H], ['2', S], ['3', D], ['4', C], ['5', H]))).toBe('straight')
  })

  it('three of a kind', () => {
    expect(evaluateHand(h(['6', H], ['6', S], ['6', D], ['2', C], ['KING', H]))).toBe(
      'three-of-a-kind',
    )
  })

  it('two pair', () => {
    expect(evaluateHand(h(['8', H], ['8', S], ['3', D], ['3', C], ['KING', H]))).toBe('two-pair')
  })

  it('a pair of jacks pays', () => {
    expect(evaluateHand(h(['JACK', H], ['JACK', S], ['3', D], ['7', C], ['KING', H]))).toBe(
      'jacks-or-better',
    )
  })

  it('a low pair does not pay', () => {
    expect(evaluateHand(h(['10', H], ['10', S], ['3', D], ['7', C], ['KING', H]))).toBe('nothing')
  })

  it('nothing / high card', () => {
    expect(evaluateHand(h(['2', H], ['5', S], ['8', D], ['JACK', C], ['KING', H]))).toBe('nothing')
  })

  it('almost-straight is nothing (no wrap past the ace)', () => {
    expect(evaluateHand(h(['QUEEN', H], ['KING', S], ['ACE', D], ['2', C], ['3', H]))).toBe(
      'nothing',
    )
  })
})

describe('payout', () => {
  it('scales linearly with the bet', () => {
    expect(payout('flush', 1)).toBe(6)
    expect(payout('flush', 3)).toBe(18)
    expect(payout('jacks-or-better', 4)).toBe(4)
    expect(payout('nothing', 5)).toBe(0)
  })

  it('gives the royal-flush bonus only at max bet', () => {
    expect(payout('royal-flush', 4)).toBe(1000)
    expect(payout('royal-flush', 5)).toBe(4000)
  })
})

describe('drawSlots', () => {
  it('lists the indexes that were not held', () => {
    expect(drawSlots([true, false, false, true, false])).toEqual([1, 2, 4])
    expect(drawSlots([true, true, true, true, true])).toEqual([])
  })
})

describe('videoPokerReducer', () => {
  const dealt = (): VideoPokerState => {
    const s = videoPokerReducer(
      { ...initVideoPoker(), bet: 5 },
      { type: 'DEAL', cards: h(['JACK', H], ['JACK', S], ['3', D], ['7', C], ['KING', H]) },
    )
    return s
  }

  it('DEAL stakes the bet and moves to holding', () => {
    const s = dealt()
    expect(s.phase).toBe('holding')
    expect(s.bank).toBe(95)
    expect(s.hand).toHaveLength(5)
    expect(s.held.every((x) => !x)).toBe(true)
  })

  it('TOGGLE_HOLD flips one slot', () => {
    const s = videoPokerReducer(dealt(), { type: 'TOGGLE_HOLD', index: 0 })
    expect(s.held).toEqual([true, false, false, false, false])
  })

  it('DRAW replaces only unheld cards, scores, and pays', () => {
    let s = dealt()
    s = videoPokerReducer(s, { type: 'TOGGLE_HOLD', index: 0 }) // keep JACK H
    s = videoPokerReducer(s, { type: 'TOGGLE_HOLD', index: 1 }) // keep JACK S
    s = videoPokerReducer(s, {
      type: 'DRAW',
      replacements: h(['JACK', D], ['9', C], ['2', S]),
    })
    expect(s.hand[0].rank).toBe('JACK')
    expect(s.hand[1].rank).toBe('JACK')
    expect(s.hand[2].code).toBe(card('JACK', 'DIAMONDS').code)
    expect(s.result?.category).toBe('three-of-a-kind')
    expect(s.result?.payout).toBe(15) // 3-of-a-kind pays 3/credit * 5
    expect(s.bank).toBe(110) // 95 staked + 15 back
    expect(s.phase).toBe('result')
  })

  it('NEW_HAND returns to betting', () => {
    let s = dealt()
    // Held nothing — the draw replaces all five.
    s = videoPokerReducer(s, {
      type: 'DRAW',
      replacements: h(['2', S], ['4', D], ['9', C], ['6', H], ['8', S]),
    })
    expect(s.phase).toBe('result')
    s = videoPokerReducer(s, { type: 'NEW_HAND' })
    expect(s.phase).toBe('bet')
    expect(s.hand).toEqual([])
  })

  it('ignores DEAL when the bet exceeds the bank', () => {
    const broke: VideoPokerState = { ...initVideoPoker(), bank: 2, bet: 5 }
    expect(videoPokerReducer(broke, { type: 'DEAL', cards: [] })).toBe(broke)
  })
})
