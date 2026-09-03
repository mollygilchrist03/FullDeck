import { describe, expect, it } from 'vitest'
import { compareCards, resolveBattle } from './warLogic'
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

describe('resolveBattle', () => {
  it('gives the pot (spoils + both cards) to the higher card', () => {
    const spoils = [card('2'), card('3')]
    const { winner, pot } = resolveBattle(card('KING'), card('4'), spoils)
    expect(winner).toBe('player')
    expect(pot).toHaveLength(4)
  })

  it('declares no winner on a tie but still stacks the pot', () => {
    const { winner, pot } = resolveBattle(card('9'), card('9'), [card('2')])
    expect(winner).toBeNull()
    expect(pot).toHaveLength(3)
  })
})

const deck = (ranks: Parameters<typeof card>[0][]): Card[] => ranks.map((r) => card(r))

describe('warReducer', () => {
  const start = (p: Card[], d: Card[]): WarState =>
    warReducer(initWar(), { type: 'START', playerPile: p, dealerPile: d })

  it('deals into a ready state', () => {
    const s = start(deck(['KING', '2']), deck(['3', '4']))
    expect(s.phase).toBe('ready')
    expect(s.playerPile).toHaveLength(2)
  })

  it('awards a decisive battle to the winner and conserves all 4 cards', () => {
    const s = warReducer(start(deck(['KING', '2']), deck(['3', '4'])), { type: 'FLIP' })
    expect(s.lastWinner).toBe('player')
    // Won cards fold straight into the winner's pile — all 4 accounted for.
    expect(s.playerPile.length + s.dealerPile.length).toBe(4)
    expect(s.playerPile).toHaveLength(3)
    expect(s.dealerPile).toHaveLength(1)
    expect(s.phase).toBe('ready')
  })

  it('goes to war on a tie and stakes both cards', () => {
    const s = warReducer(start(deck(['7', '9']), deck(['7', '2'])), { type: 'FLIP' })
    expect(s.phase).toBe('war')
    expect(s.spoils).toHaveLength(2)
    expect(s.playerPile).toHaveLength(1)
  })

  it('resolves a war on the next flip, pot going to the higher card', () => {
    let s = start(deck(['7', 'ACE']), deck(['7', '3']))
    s = warReducer(s, { type: 'FLIP' }) // tie
    s = warReducer(s, { type: 'FLIP' }) // ACE vs 3
    expect(s.winner ?? s.lastWinner).toBe('player')
    expect(s.spoils).toHaveLength(0)
    expect(s.playerPile.length + s.dealerPile.length).toBe(4)
  })

  it('ends the game when a player runs out of cards', () => {
    const s = warReducer(start(deck(['KING']), deck(['2'])), { type: 'FLIP' })
    expect(s.phase).toBe('gameover')
    expect(s.winner).toBe('player')
  })

  it('a player who cannot flip loses', () => {
    const mid: WarState = { ...initWar(), phase: 'ready', playerPile: [], dealerPile: deck(['2']) }
    expect(warReducer(mid, { type: 'FLIP' }).winner).toBe('dealer')
  })
})
