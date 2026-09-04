import { describe, expect, it } from 'vitest'
import { initSlapjack, isJack, slapjackReducer, type SlapjackState } from './slapjackReducer'
import { card } from '../../test/helpers'
import type { Card } from '../../types/card'

const deck = (ranks: Parameters<typeof card>[0][]): Card[] => ranks.map((r) => card(r))
const start = (p: Card[], a: Card[]): SlapjackState =>
  slapjackReducer(initSlapjack(), { type: 'START', playerPile: p, aiPile: a })

describe('isJack', () => {
  it('is true only for jacks', () => {
    expect(isJack(card('JACK'))).toBe(true)
    expect(isJack(card('10'))).toBe(false)
    expect(isJack(undefined)).toBe(false)
  })
})

describe('slapjackReducer', () => {
  it('FLIP moves the current player\'s top card to the centre and passes the turn', () => {
    const s = slapjackReducer(start(deck(['2', '3']), deck(['4', '5'])), { type: 'FLIP' })
    expect(s.center.map((c) => c.rank)).toEqual(['2'])
    expect(s.playerPile).toHaveLength(1)
    expect(s.turn).toBe('ai')
    expect(s.phase).toBe('flipping')
  })

  it('flipping a Jack opens the slap window', () => {
    const s = slapjackReducer(start(deck(['JACK', '3']), deck(['4', '5'])), { type: 'FLIP' })
    expect(s.phase).toBe('slap')
  })

  it('a legal slap gives the whole centre pile to the slapper', () => {
    let s = start(deck(['JACK', '2']), deck(['4', '5']))
    s = slapjackReducer(s, { type: 'FLIP' }) // player flips a Jack
    s = slapjackReducer(s, { type: 'SLAP', who: 'player' })
    expect(s.phase).toBe('flipping')
    expect(s.center).toHaveLength(0)
    expect(s.playerPile.map((c) => c.rank)).toContain('JACK')
    expect(s.slaps.player).toBe(1)
  })

  it('a false slap forfeits a card to the other side', () => {
    let s = start(deck(['2', '3', '9']), deck(['4', '5']))
    s = slapjackReducer(s, { type: 'FLIP' }) // centre: 2 (not a jack)
    const before = s.playerPile.length
    s = slapjackReducer(s, { type: 'SLAP', who: 'player' })
    expect(s.playerPile).toHaveLength(before - 1)
    expect(s.aiPile).toHaveLength(3)
  })

  it('resolves by slap count when the last card is flipped and nobody can slap', () => {
    // Player flips their only card (a 2, not a Jack); the AI is already empty.
    let s = start(deck(['2']), [])
    s = { ...s, slaps: { player: 2, ai: 1 } }
    s = slapjackReducer(s, { type: 'FLIP' })
    expect(s.phase).toBe('gameover')
    expect(s.winner).toBe('player') // more slaps
  })

  it('ends the game when one side holds every card', () => {
    let s = start(deck(['JACK']), deck(['5']))
    s = slapjackReducer(s, { type: 'FLIP' }) // player flips the Jack
    s = slapjackReducer(s, { type: 'SLAP', who: 'ai' }) // dealer beats player to it
    expect(s.phase).toBe('gameover')
    expect(s.winner).toBe('ai') // dealer holds both cards, player has none
  })
})
