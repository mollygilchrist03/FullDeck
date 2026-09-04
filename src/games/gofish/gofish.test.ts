import { describe, expect, it } from 'vitest'
import { chooseAiAsk, takeBooks } from './goFishLogic'
import { goFishReducer, initGoFish, type GoFishState } from './goFishReducer'
import { hand } from '../../test/helpers'

describe('takeBooks', () => {
  it('pulls a completed four and keeps the rest', () => {
    const { hand: kept, books } = takeBooks(hand('ACE', 'ACE', 'ACE', 'ACE', 'KING', 'KING'))
    expect(books).toEqual(['ACE'])
    expect(kept).toHaveLength(2)
  })
  it('leaves an incomplete set alone', () => {
    expect(takeBooks(hand('7', '7', '7')).books).toEqual([])
  })
})

describe('chooseAiAsk', () => {
  it('asks for the rank it holds most of', () => {
    expect(chooseAiAsk(hand('2', '2', '9'), [])).toBe('2')
  })
  it('prefers a rank the player is known to hold', () => {
    expect(chooseAiAsk(hand('2', '2', '9'), ['9'])).toBe('9')
  })
  it('returns null with an empty hand', () => {
    expect(chooseAiAsk([], ['9'])).toBeNull()
  })
})

const seed = (over: Partial<GoFishState> = {}): GoFishState => ({
  ...goFishReducer(initGoFish(), {
    type: 'START',
    playerHand: hand('3', '5', '9'),
    aiHand: hand('3', '3', '7'),
    stock: hand('KING', '9', '3'),
  }),
  ...over,
})

describe('goFishReducer', () => {
  it('START pulls any books already dealt', () => {
    const s = goFishReducer(initGoFish(), {
      type: 'START',
      playerHand: hand('4', '4', '4', '4', '2'),
      aiHand: hand('7'),
      stock: [],
    })
    expect(s.playerBooks).toEqual(['4'])
    expect(s.playerHand).toHaveLength(1)
  })

  it('a hit transfers every matching card and keeps the turn', () => {
    const s = goFishReducer(seed(), { type: 'ASK', rank: '3' })
    expect(s.playerHand.filter((c) => c.rank === '3')).toHaveLength(3)
    expect(s.aiHand.some((c) => c.rank === '3')).toBe(false)
    expect(s.phase).toBe('playerAsk')
  })

  it('a miss sends you to a draw you have to click, then passes the turn', () => {
    let s = goFishReducer(seed(), { type: 'ASK', rank: '5' }) // AI has no 5s
    expect(s.phase).toBe('playerDraw')
    expect(s.pendingRank).toBe('5')
    expect(s.playerHand).toHaveLength(3) // not drawn yet
    s = goFishReducer(s, { type: 'DRAW' })
    expect(s.playerHand).toHaveLength(4) // drew the KING
    expect(s.phase).toBe('aiAsk')
  })

  it('fishing exactly what you asked for lets you go again', () => {
    let s = goFishReducer(seed({ stock: hand('9', 'KING') }), { type: 'ASK', rank: '9' })
    expect(s.phase).toBe('playerDraw')
    s = goFishReducer(s, { type: 'DRAW' }) // top of stock is a 9
    expect(s.phase).toBe('playerAsk')
    expect(s.playerHand.filter((c) => c.rank === '9')).toHaveLength(2)
  })

  it('AI_STEP takes from the player on a hit and steps again', () => {
    const s = goFishReducer(seed({ phase: 'aiAsk' }), { type: 'AI_STEP' })
    // AI holds two 3s; player holds one 3 -> AI takes it, stays aiAsk.
    expect(s.aiHand.filter((c) => c.rank === '3')).toHaveLength(3)
    expect(s.phase).toBe('aiAsk')
    expect(s.aiSteps).toBe(1)
  })

  it('an empty-handed player draws up from the stock instead of stalling', () => {
    // AI clears the player's hand, then misses and fishes; the turn returns to
    // an empty player, who must draw up.
    let s = seed({
      phase: 'aiAsk',
      playerHand: hand('3'),
      aiHand: hand('3', '3'),
      stock: hand('9', 'KING'),
    })
    s = goFishReducer(s, { type: 'AI_STEP' }) // takes the player's 3
    expect(s.playerHand).toHaveLength(0)
    s = goFishReducer(s, { type: 'AI_STEP' }) // asks again, misses -> aiDraw
    expect(s.phase).toBe('aiDraw')
    s = goFishReducer(s, { type: 'AI_STEP' }) // AI fishes a 9 (no match) -> turn to empty player
    expect(s.phase).toBe('playerDraw')
    expect(s.pendingRank).toBeNull()
    s = goFishReducer(s, { type: 'DRAW' })
    expect(s.phase).toBe('playerAsk')
    expect(s.playerHand.length).toBeGreaterThan(0)
  })

  it('ends the game if every card is gone even below thirteen books', () => {
    const s = goFishReducer(initGoFish(), {
      type: 'START',
      playerHand: hand('4', '4', '4', '4'),
      aiHand: [],
      stock: [],
    })
    expect(s.phase).toBe('gameover')
    expect(s.winner).toBe('player')
  })

  it('ends when all thirteen books are made', () => {
    const almost = seed({
      playerBooks: ['2', '3', '4', '5', '6', '7'],
      aiBooks: ['8', '9', '10', 'JACK', 'QUEEN', 'KING'],
      playerHand: hand('ACE', 'ACE', 'ACE'),
      aiHand: hand('ACE'),
      stock: [],
    })
    const s = goFishReducer(almost, { type: 'ASK', rank: 'ACE' })
    expect(s.phase).toBe('gameover')
    expect(s.winner).toBe('player')
    expect(s.playerBooks).toContain('ACE')
  })
})
