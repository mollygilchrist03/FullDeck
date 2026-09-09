import { describe, expect, it } from 'vitest'
import { initSlapjack, isJack, slapjackReducer, type SlapjackState } from './slapjackReducer'
import { card, shuffledDeck } from '../../test/helpers'
import type { Card } from '../../types/card'

const deck = (ranks: Parameters<typeof card>[0][]): Card[] => ranks.map((r) => card(r))
/** Seat 0 = "you", seat 1 = "the dealer" unless more piles are passed. */
const start = (...piles: Card[][]): SlapjackState =>
  slapjackReducer(initSlapjack(piles.length), { type: 'START', piles })

describe('isJack', () => {
  it('is true only for jacks', () => {
    expect(isJack(card('JACK'))).toBe(true)
    expect(isJack(card('10'))).toBe(false)
    expect(isJack(undefined)).toBe(false)
  })
})

describe('slapjackReducer', () => {
  it('FLIP moves the current seat\'s top card to the centre and passes the turn', () => {
    const s = slapjackReducer(start(deck(['2', '3']), deck(['4', '5'])), { type: 'FLIP' })
    expect(s.center.map((c) => c.rank)).toEqual(['2'])
    expect(s.piles[0]).toHaveLength(1)
    expect(s.turn).toBe(1)
    expect(s.phase).toBe('flipping')
  })

  it('flipping a Jack opens the slap window', () => {
    const s = slapjackReducer(start(deck(['JACK', '3']), deck(['4', '5'])), { type: 'FLIP' })
    expect(s.phase).toBe('slap')
  })

  it('a legal slap gives the whole centre pile to the slapper', () => {
    let s = start(deck(['JACK', '2']), deck(['4', '5']))
    s = slapjackReducer(s, { type: 'FLIP' }) // seat 0 flips a Jack
    s = slapjackReducer(s, { type: 'SLAP', who: 0 })
    expect(s.phase).toBe('flipping')
    expect(s.center).toHaveLength(0)
    expect(s.piles[0].map((c) => c.rank)).toContain('JACK')
    expect(s.slaps[0]).toBe(1)
  })

  it('a false slap forfeits a card to the next seat', () => {
    let s = start(deck(['2', '3', '9']), deck(['4', '5']))
    s = slapjackReducer(s, { type: 'FLIP' }) // centre: 2 (not a jack)
    const before = s.piles[0].length
    s = slapjackReducer(s, { type: 'SLAP', who: 0 })
    expect(s.piles[0]).toHaveLength(before - 1)
    expect(s.piles[1]).toHaveLength(3)
  })

  it('resolves by slap count when the last card is flipped and nobody can slap', () => {
    // Seat 0 flips their only card (a 2, not a Jack); seat 1 is already empty.
    let s = start(deck(['2']), [])
    s = { ...s, slaps: [2, 1] }
    s = slapjackReducer(s, { type: 'FLIP' })
    expect(s.phase).toBe('gameover')
    expect(s.winner).toBe(0) // more slaps
  })

  it('ends the game when one seat holds every card', () => {
    let s = start(deck(['JACK']), deck(['5']))
    s = slapjackReducer(s, { type: 'FLIP' }) // seat 0 flips the Jack
    s = slapjackReducer(s, { type: 'SLAP', who: 1 }) // seat 1 beats seat 0 to it
    expect(s.phase).toBe('gameover')
    expect(s.winner).toBe(1) // seat 1 holds both cards, seat 0 has none
  })

  it('every deal plays to a finish — no stuck state (fuzz, 300 random games)', () => {
    for (let game = 0; game < 300; game += 1) {
      const d = shuffledDeck()
      let s = start(d.slice(0, 26), d.slice(26))
      let steps = 0
      while (s.phase !== 'gameover' && steps < 4000) {
        steps += 1
        if (s.phase === 'slap') {
          // Random racer takes the Jack; also throw in the occasional false slap.
          s = slapjackReducer(s, { type: 'SLAP', who: Math.random() < 0.5 ? 0 : 1 })
        } else {
          s = slapjackReducer(s, { type: 'FLIP' })
        }
      }
      expect(s.phase).toBe('gameover')
      expect(s.winner).not.toBeNull()
    }
  })

  it('a 4-seat deal plays to a finish with cards conserved (fuzz, 100 games)', () => {
    for (let game = 0; game < 100; game += 1) {
      const d = shuffledDeck()
      let s = start(d.slice(0, 13), d.slice(13, 26), d.slice(26, 39), d.slice(39))
      let steps = 0
      while (s.phase !== 'gameover' && steps < 6000) {
        steps += 1
        if (s.phase === 'slap') {
          s = slapjackReducer(s, { type: 'SLAP', who: Math.floor(Math.random() * 4) })
        } else {
          s = slapjackReducer(s, { type: 'FLIP' })
        }
      }
      expect(s.phase).toBe('gameover')
      expect(s.winner).not.toBeNull()
      const total = s.piles.reduce((sum, p) => sum + p.length, 0) + s.center.length
      expect(total).toBe(52)
    }
  })
})
