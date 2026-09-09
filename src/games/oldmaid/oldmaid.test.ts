import { describe, expect, it } from 'vitest'
import { discardPairs, removeOneQueen } from './oldMaidLogic'
import { initOldMaid, nextLiveSeat, oldMaidReducer, type OldMaidState } from './oldMaidReducer'
import { hand, shuffledDeck } from '../../test/helpers'

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

/** Seat 0 = "you", seat 1 = "the dealer" for 2-seat setups. */
const start = (...hands: ReturnType<typeof hand>[]): OldMaidState =>
  oldMaidReducer(initOldMaid(hands.length), { type: 'START', hands })

describe('oldMaidReducer', () => {
  it('START lays every pair down on every seat', () => {
    const s = start(hand('3', '3', '5'), hand('9', '9', 'QUEEN'))
    expect(s.discards[0]).toEqual(['3'])
    expect(s.discards[1]).toEqual(['9'])
    expect(s.hands[0].map((c) => c.rank)).toEqual(['5'])
    expect(s.phase).toBe('turn')
    expect(s.turn).toBe(0)
  })

  it('drawing a match discards the pair and shrinks both hands', () => {
    const s = oldMaidReducer(start(hand('5', 'QUEEN'), hand('5')), { type: 'DRAW', index: 0 })
    // seat 0 draws seat 1's 5, pairs it with their own -> keeps only the Queen
    expect(s.hands[0].map((c) => c.rank)).toEqual(['QUEEN'])
    expect(s.discards[0]).toEqual(['5'])
    expect(s.hands[1]).toHaveLength(0)
    expect(s.lastDraw).toEqual({ who: 0, rank: '5', paired: true })
  })

  it('drawing a non-match keeps the card and passes the turn', () => {
    const s = oldMaidReducer(start(hand('KING'), hand('7', 'QUEEN')), { type: 'DRAW', index: 0 })
    expect(s.hands[0].map((c) => c.rank).sort()).toEqual(['7', 'KING'])
    expect(s.turn).toBe(1)
    expect(s.turnsTaken).toBe(1)
  })

  it('the seat left with the lone Queen loses', () => {
    // seat 0 keeps the Queen -> seat 1 wins (seat 0 is the loser)
    let s = oldMaidReducer(start(hand('KING', 'QUEEN'), hand('KING')), { type: 'DRAW', index: 0 })
    expect(s.phase).toBe('gameover')
    expect(s.loser).toBe(0)

    // seat 1 keeps the Queen -> seat 0 wins
    s = oldMaidReducer(start(hand('KING'), hand('KING', 'QUEEN')), { type: 'DRAW', index: 0 })
    expect(s.phase).toBe('gameover')
    expect(s.loser).toBe(1)
  })

  it('ignores an out-of-range draw index', () => {
    const s = start(hand('KING'), hand('7', 'QUEEN'))
    expect(oldMaidReducer(s, { type: 'DRAW', index: 9 })).toBe(s)
  })

  it('nextLiveSeat skips a seat that has already emptied its hand', () => {
    const s = start(hand('KING'), hand('QUEEN'), hand('5', '5', '9'))
    // seat 1 is empty after pairing 5s... construct directly instead:
    const withEmptySeat: OldMaidState = { ...s, hands: [[], s.hands[1], s.hands[2]] }
    expect(nextLiveSeat(withEmptySeat.hands, 0)).toBe(1)
    expect(nextLiveSeat(withEmptySeat.hands, 2)).toBe(1) // wraps past the empty seat 0
  })

  it('3-way: a seat that empties draws from its live neighbor next, not the empty one', () => {
    // Seat 0 holds a lone 5 that will pair with seat 1's 5, leaving seat 0
    // empty. Seat 2 still holds cards, so seat 0's *next* turn (once it
    // becomes theirs again via the draw-target chain) must skip seat 1.
    let s = start(hand('5'), hand('5', 'QUEEN'), hand('9', 'JACK'))
    expect(s.turn).toBe(0)
    s = oldMaidReducer(s, { type: 'DRAW', index: 0 }) // seat 0 draws seat 1's 5 -> pairs, seat 0 now empty
    expect(s.hands[0]).toHaveLength(0)
    expect(s.turn).toBe(1) // turn passes to whoever was drawn from
    // Seat 1 (now with just the Queen) draws next, from nextLiveSeat(hands, 1).
    expect(nextLiveSeat(s.hands, 1)).toBe(2) // seat 0 is empty, skip to seat 2
  })

  it('every 2-seat deal plays to a finish — no stuck state (fuzz, 400 random games)', () => {
    for (let game = 0; game < 400; game += 1) {
      const d = removeOneQueen(shuffledDeck())
      let s = oldMaidReducer(initOldMaid(2), {
        type: 'START',
        hands: [d.slice(0, 26), d.slice(26)],
      })
      let steps = 0
      while (s.phase !== 'gameover' && steps < 2000) {
        steps += 1
        const target = nextLiveSeat(s.hands, s.turn)
        const opp = s.hands[target]
        s = oldMaidReducer(s, { type: 'DRAW', index: Math.floor(Math.random() * opp.length) })
      }
      expect(s.phase).toBe('gameover')
      expect(s.loser).not.toBeNull()
    }
  })

  it('every 6-seat deal plays to a finish — no stuck state (fuzz, 150 random games)', () => {
    const SEATS = 6
    for (let game = 0; game < 150; game += 1) {
      const d = removeOneQueen(shuffledDeck())
      const base = Math.floor(d.length / SEATS)
      const extra = d.length % SEATS
      const hands: (typeof d)[] = []
      let idx = 0
      for (let i = 0; i < SEATS; i += 1) {
        const size = base + (i < extra ? 1 : 0)
        hands.push(d.slice(idx, idx + size))
        idx += size
      }
      let s = oldMaidReducer(initOldMaid(SEATS), { type: 'START', hands })
      let steps = 0
      while (s.phase !== 'gameover' && steps < 4000) {
        steps += 1
        const target = nextLiveSeat(s.hands, s.turn)
        const opp = s.hands[target]
        s = oldMaidReducer(s, { type: 'DRAW', index: Math.floor(Math.random() * opp.length) })
      }
      expect(s.phase).toBe('gameover')
      expect(s.loser).not.toBeNull()
      const total = s.hands.reduce((sum, h) => sum + h.length, 0)
      expect(total).toBe(1)
    }
  })
})
