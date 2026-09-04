import { describe, expect, it } from 'vitest'
import { discardPairs, removeOneQueen } from './oldMaidLogic'
import { initOldMaid, oldMaidReducer, type OldMaidState } from './oldMaidReducer'
import { hand } from '../../test/helpers'
import type { Card } from '../../types/card'

describe('removeOneQueen', () => {
  it('drops exactly one queen', () => {
    const deck = hand('QUEEN', 'QUEEN', 'QUEEN', 'QUEEN', 'KING')
    const out = removeOneQueen(deck)
    expect(out.filter((c) => c.rank === 'QUEEN')).toHaveLength(3)
    expect(out).toHaveLength(4)
  })
})

describe('discardPairs', () => {
  it('lays down pairs and keeps the odd card', () => {
    expect(discardPairs(hand('KING', 'KING')).pairs).toEqual(['KING'])
    expect(discardPairs(hand('KING', 'KING')).hand).toHaveLength(0)

    const three = discardPairs(hand('7', '7', '7'))
    expect(three.pairs).toEqual(['7'])
    expect(three.hand).toHaveLength(1)

    const four = discardPairs(hand('2', '2', '2', '2', '9'))
    expect(four.pairs).toEqual(['2', '2'])
    expect(four.hand.map((c) => c.rank)).toEqual(['9'])
  })
})

const start = (p: Card[], a: Card[]): OldMaidState =>
  oldMaidReducer(initOldMaid(), { type: 'START', playerHand: p, aiHand: a })

describe('oldMaidReducer', () => {
  it('START lays every pair down on both sides', () => {
    const s = start(hand('3', '3', '5'), hand('9', '9', 'QUEEN'))
    expect(s.playerDiscards).toEqual(['3'])
    expect(s.aiDiscards).toEqual(['9'])
    expect(s.playerHand.map((c) => c.rank)).toEqual(['5'])
    expect(s.phase).toBe('playerTurn')
  })

  it('drawing a match discards the pair and shrinks both hands', () => {
    const s = oldMaidReducer(start(hand('5', 'QUEEN'), hand('5')), { type: 'DRAW', index: 0 })
    // player draws the dealer's 5, pairs it with their own -> keeps only the Queen
    expect(s.playerHand.map((c) => c.rank)).toEqual(['QUEEN'])
    expect(s.playerDiscards).toEqual(['5'])
    expect(s.aiHand).toHaveLength(0)
    expect(s.lastDraw).toEqual({ who: 'player', rank: '5', paired: true })
  })

  it('drawing a non-match keeps the card and passes the turn', () => {
    const s = oldMaidReducer(start(hand('KING'), hand('7', 'QUEEN')), { type: 'DRAW', index: 0 })
    expect(s.playerHand.map((c) => c.rank).sort()).toEqual(['7', 'KING'])
    expect(s.turn).toBe('ai')
    expect(s.phase).toBe('aiTurn')
    expect(s.turnsTaken).toBe(1)
  })

  it('the side left with the lone Queen loses', () => {
    // player keeps the Queen -> dealer wins
    let s = oldMaidReducer(start(hand('KING', 'QUEEN'), hand('KING')), { type: 'DRAW', index: 0 })
    expect(s.phase).toBe('gameover')
    expect(s.winner).toBe('ai')

    // dealer keeps the Queen -> player wins
    s = oldMaidReducer(start(hand('KING'), hand('KING', 'QUEEN')), { type: 'DRAW', index: 0 })
    expect(s.phase).toBe('gameover')
    expect(s.winner).toBe('player')
  })

  it('ignores an out-of-range draw index', () => {
    const s = start(hand('KING'), hand('7', 'QUEEN'))
    expect(oldMaidReducer(s, { type: 'DRAW', index: 9 })).toBe(s)
  })
})
