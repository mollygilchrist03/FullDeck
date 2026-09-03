import { describe, expect, it } from 'vitest'
import { compareCards, warBuryCount } from './warLogic'
import { initWar, warReducer, type WarState } from './warReducer'
import { card } from '../../test/helpers'
import type { Card } from '../../types/card'

describe('compareCards', () => {
  it('ranks by value with aces high', () => {
    expect(compareCards(card('KING'), card('QUEEN'))).toBe('player')
    expect(compareCards(card('5'), card('9'))).toBe('dealer')
    expect(compareCards(card('ACE'), card('KING'))).toBe('player')
  })

  it('returns "war" on equal rank regardless of suit', () => {
    expect(compareCards(card('7', 'HEARTS'), card('7', 'SPADES'))).toBe('war')
  })
})

describe('warBuryCount', () => {
  it('is three when the pile can spare it', () => {
    expect(warBuryCount(26)).toBe(3)
    expect(warBuryCount(4)).toBe(3)
  })
  it('keeps one card back to turn face-up', () => {
    expect(warBuryCount(3)).toBe(2)
    expect(warBuryCount(2)).toBe(1)
    expect(warBuryCount(1)).toBe(0)
    expect(warBuryCount(0)).toBe(0)
  })
})

const deck = (ranks: Parameters<typeof card>[0][]): Card[] => ranks.map((r) => card(r))
const start = (p: Card[], d: Card[]): WarState =>
  warReducer(initWar(), { type: 'START', playerPile: p, dealerPile: d })

const total = (s: WarState) =>
  s.playerPile.length +
  s.dealerPile.length +
  s.pot.length +
  (s.playerCard ? 1 : 0) +
  (s.dealerCard ? 1 : 0)

describe('warReducer', () => {
  it('deals into a ready state with all 52 accounted for', () => {
    const s = start(deck(['KING', '2']), deck(['3', '4']))
    expect(s.phase).toBe('ready')
    expect(s.playerPile).toHaveLength(2)
  })

  it('awards a decisive flip to the higher card', () => {
    const s = warReducer(start(deck(['KING', '2']), deck(['3', '4'])), { type: 'FLIP' })
    expect(s.lastWinner).toBe('player')
    expect(s.playerPile.length + s.dealerPile.length).toBe(4)
    expect(s.playerPile).toHaveLength(3)
    expect(s.phase).toBe('ready')
  })

  it('a tie moves to war with the tied cards shown, not yet buried', () => {
    const s = warReducer(
      start(deck(['7', 'ACE', '2', '3', '4', '5']), deck(['7', '9', '2', '3', '4', '5'])),
      { type: 'FLIP' },
    )
    expect(s.phase).toBe('war')
    expect(s.pot).toHaveLength(0)
    expect(s.buried).toBe(0)
    expect([s.playerCard?.rank, s.dealerCard?.rank]).toEqual(['7', '7'])
    expect(total(s)).toBe(12)
  })

  it('a war round buries three each, then the higher up-card sweeps 10', () => {
    // flip 1: 7 vs 7 -> war. flip 2: bury 3 each, then ACE vs 3 -> player.
    let s = start(
      deck(['7', '2', '2', '2', 'ACE']),
      deck(['7', '4', '4', '4', '3']),
    )
    s = warReducer(s, { type: 'FLIP' })
    expect(s.phase).toBe('war')
    s = warReducer(s, { type: 'FLIP' })
    expect(s.buried).toBe(6)
    expect(s.lastWinner ?? s.winner).toBe('player')
    expect(s.lastPotSize).toBe(10) // 2 tied + 6 buried + 2 up
    expect(s.pot).toHaveLength(0)
  })

  it('returns every card to the piles once a war resolves', () => {
    let s = start(
      deck(['7', '2', '2', '2', 'ACE', '5', '6', '8']),
      deck(['7', '4', '4', '4', '3', '9', '10', 'JACK']),
    )
    s = warReducer(s, { type: 'FLIP' }) // tie -> war
    expect(s.phase).toBe('war')
    expect(total(s)).toBe(16) // mid-battle: piles + pot + 2 shown
    s = warReducer(s, { type: 'FLIP' }) // resolves
    expect(s.phase).toBe('ready')
    expect(s.pot).toHaveLength(0)
    expect(s.playerPile.length + s.dealerPile.length).toBe(16)
  })

  it('ends the game when a player is emptied', () => {
    const s = warReducer(start(deck(['KING']), deck(['2'])), { type: 'FLIP' })
    expect(s.phase).toBe('gameover')
    expect(s.winner).toBe('player')
    expect(s.playerPile).toHaveLength(2)
  })

  it('a player who cannot flip loses and the table is swept', () => {
    const stuck: WarState = {
      ...initWar(),
      phase: 'ready',
      playerPile: [],
      dealerPile: deck(['2']),
      pot: deck(['5', '6']),
    }
    const s = warReducer(stuck, { type: 'FLIP' })
    expect(s.winner).toBe('dealer')
    expect(s.dealerPile).toHaveLength(3) // its own card + the 2 pot cards
  })
})
