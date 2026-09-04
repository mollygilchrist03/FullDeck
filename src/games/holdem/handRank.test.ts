import { describe, expect, it } from 'vitest'
import { bestHand, compareHandRank, evaluateFive } from './handRank'
import { card } from '../../test/helpers'

describe('evaluateFive', () => {
  it('recognises a royal flush', () => {
    const r = evaluateFive([
      card('10', 'HEARTS'),
      card('JACK', 'HEARTS'),
      card('QUEEN', 'HEARTS'),
      card('KING', 'HEARTS'),
      card('ACE', 'HEARTS'),
    ])
    expect(r.category).toBe('straight-flush')
    expect(r.royal).toBe(true)
  })

  it('recognises a wheel straight (A-2-3-4-5) with 5 as the high card', () => {
    const r = evaluateFive([
      card('ACE', 'SPADES'),
      card('2', 'HEARTS'),
      card('3', 'CLUBS'),
      card('4', 'DIAMONDS'),
      card('5', 'SPADES'),
    ])
    expect(r.category).toBe('straight')
    expect(r.tiebreak).toEqual([5])
  })

  it('four of a kind outranks a full house, with the right tiebreak', () => {
    const quads = evaluateFive([
      card('KING', 'HEARTS'),
      card('KING', 'DIAMONDS'),
      card('KING', 'CLUBS'),
      card('KING', 'SPADES'),
      card('2', 'HEARTS'),
    ])
    expect(quads.category).toBe('four-of-a-kind')
    expect(quads.tiebreak).toEqual([13, 2])
  })

  it('a full house tiebreaks on trip rank first, then pair rank', () => {
    const a = evaluateFive([
      card('9', 'HEARTS'),
      card('9', 'DIAMONDS'),
      card('9', 'CLUBS'),
      card('2', 'SPADES'),
      card('2', 'HEARTS'),
    ])
    expect(a.category).toBe('full-house')
    expect(a.tiebreak).toEqual([9, 2])
  })

  it('two pair orders the pairs high-then-low and keeps the kicker', () => {
    const r = evaluateFive([
      card('4', 'HEARTS'),
      card('4', 'DIAMONDS'),
      card('9', 'CLUBS'),
      card('9', 'SPADES'),
      card('ACE', 'HEARTS'),
    ])
    expect(r.category).toBe('two-pair')
    expect(r.tiebreak).toEqual([9, 4, 14])
  })

  it('a pair below jacks is still just "pair" — no video-poker cutoff here', () => {
    const r = evaluateFive([
      card('3', 'HEARTS'),
      card('3', 'DIAMONDS'),
      card('9', 'CLUBS'),
      card('7', 'SPADES'),
      card('2', 'HEARTS'),
    ])
    expect(r.category).toBe('pair')
  })

  it('high card sorts every value descending for the tiebreak', () => {
    const r = evaluateFive([
      card('2', 'HEARTS'),
      card('9', 'DIAMONDS'),
      card('JACK', 'CLUBS'),
      card('7', 'SPADES'),
      card('KING', 'HEARTS'),
    ])
    expect(r.category).toBe('high-card')
    expect(r.tiebreak).toEqual([13, 11, 9, 7, 2])
  })
})

describe('compareHandRank', () => {
  it('a higher category always wins regardless of tiebreak values', () => {
    const trips = evaluateFive([card('2', 'HEARTS'), card('2', 'DIAMONDS'), card('2', 'CLUBS'), card('4', 'SPADES'), card('5', 'HEARTS')])
    const straight = evaluateFive([card('3', 'HEARTS'), card('4', 'DIAMONDS'), card('5', 'CLUBS'), card('6', 'SPADES'), card('7', 'HEARTS')])
    expect(compareHandRank(straight, trips)).toBeGreaterThan(0)
  })

  it('within the same category, the tiebreak decides', () => {
    const acePair = evaluateFive([card('ACE', 'HEARTS'), card('ACE', 'DIAMONDS'), card('4', 'CLUBS'), card('6', 'SPADES'), card('7', 'HEARTS')])
    const kingPair = evaluateFive([card('KING', 'HEARTS'), card('KING', 'DIAMONDS'), card('4', 'CLUBS'), card('6', 'SPADES'), card('7', 'HEARTS')])
    expect(compareHandRank(acePair, kingPair)).toBeGreaterThan(0)
  })

  it('identical hands tie', () => {
    const cards = [card('ACE', 'HEARTS'), card('ACE', 'DIAMONDS'), card('4', 'CLUBS'), card('6', 'SPADES'), card('7', 'HEARTS')]
    expect(compareHandRank(evaluateFive(cards), evaluateFive([...cards]))).toBe(0)
  })
})

describe('bestHand', () => {
  it('picks the best 5 of 7 cards (hole + full board)', () => {
    // Hole: pocket aces. The board pairs both the ace and the king — best
    // hand is trip aces full of kings, not just two pair.
    const cards = [
      card('ACE', 'HEARTS'),
      card('ACE', 'DIAMONDS'),
      card('ACE', 'CLUBS'),
      card('KING', 'CLUBS'),
      card('KING', 'SPADES'),
      card('9', 'CLUBS'),
      card('4', 'DIAMONDS'),
    ]
    const r = bestHand(cards)
    expect(r.category).toBe('full-house')
    expect(r.tiebreak).toEqual([14, 13])
  })

  it('finds a flush that uses the board plus one hole card', () => {
    const cards = [
      card('2', 'HEARTS'),
      card('9', 'CLUBS'), // dead card, not part of the flush
      card('4', 'HEARTS'),
      card('7', 'HEARTS'),
      card('10', 'HEARTS'),
      card('KING', 'HEARTS'),
      card('3', 'SPADES'),
    ]
    const r = bestHand(cards)
    expect(r.category).toBe('flush')
  })

  it('works with exactly 5 cards (no combination search needed)', () => {
    const r = bestHand([card('2', 'HEARTS'), card('3', 'HEARTS'), card('4', 'HEARTS'), card('5', 'HEARTS'), card('7', 'HEARTS')])
    expect(r.category).toBe('flush')
  })
})
