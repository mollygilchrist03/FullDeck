import { describe, expect, it } from 'vitest'
import { chooseAiPlay, isPlayable, strongestSuit } from './crazyEightsLogic'
import {
  crazyEightsReducer,
  initCrazyEights,
  topCard,
  type CrazyEightsState,
} from './crazyEightsReducer'
import { card } from '../../test/helpers'

describe('isPlayable', () => {
  const top = card('7', 'HEARTS')
  it('matches on suit', () => {
    expect(isPlayable(card('2', 'HEARTS'), top, 'HEARTS')).toBe(true)
  })
  it('matches on rank', () => {
    expect(isPlayable(card('7', 'CLUBS'), top, 'HEARTS')).toBe(true)
  })
  it('an eight is always playable', () => {
    expect(isPlayable(card('8', 'SPADES'), top, 'HEARTS')).toBe(true)
  })
  it('uses the active suit, not the top card suit', () => {
    expect(isPlayable(card('3', 'CLUBS'), top, 'CLUBS')).toBe(true)
    expect(isPlayable(card('3', 'HEARTS'), top, 'CLUBS')).toBe(false)
  })
})

describe('strongestSuit', () => {
  it('picks the most-held suit and ignores eights', () => {
    const hand = [card('2', 'CLUBS'), card('9', 'CLUBS'), card('8', 'CLUBS'), card('4', 'DIAMONDS')]
    expect(strongestSuit(hand)).toBe('CLUBS')
  })
})

describe('chooseAiPlay', () => {
  const top = card('7', 'HEARTS')
  it('plays a matching non-eight, keeping eights in hand', () => {
    const hand = [card('8', 'SPADES'), card('7', 'CLUBS'), card('2', 'DIAMONDS')]
    expect(chooseAiPlay(hand, top, 'HEARTS')?.card.rank).toBe('7')
  })
  it('falls back to an eight and names its strongest suit', () => {
    const hand = [card('8', 'SPADES'), card('4', 'DIAMONDS'), card('9', 'DIAMONDS')]
    const play = chooseAiPlay(hand, top, 'HEARTS')
    expect(play?.card.rank).toBe('8')
    expect(play?.suit).toBe('DIAMONDS')
  })
  it('returns null when nothing is playable', () => {
    const hand = [card('4', 'CLUBS'), card('9', 'SPADES')]
    expect(chooseAiPlay(hand, top, 'HEARTS')).toBeNull()
  })
})

const setup = (over: Partial<CrazyEightsState> = {}): CrazyEightsState => ({
  ...crazyEightsReducer(initCrazyEights(), {
    type: 'START',
    stock: [card('2', 'SPADES'), card('3', 'SPADES')],
    discard: [card('7', 'HEARTS')],
    playerHand: [card('7', 'CLUBS'), card('8', 'DIAMONDS'), card('4', 'HEARTS')],
    aiHand: [card('9', 'HEARTS'), card('2', 'CLUBS')],
    activeSuit: 'HEARTS',
  }),
  ...over,
})

describe('crazyEightsReducer', () => {
  it('START deals into the player turn', () => {
    const s = setup()
    expect(s.phase).toBe('playerTurn')
    expect(topCard(s).rank).toBe('7')
    expect(s.activeSuit).toBe('HEARTS')
  })

  it('rejects an unplayable card', () => {
    const s = setup()
    // index 0 is 7C — plays on rank. index 2 is 4H — plays on suit. Make an illegal one:
    const illegal = setup({ playerHand: [card('5', 'CLUBS'), card('4', 'HEARTS')] })
    expect(crazyEightsReducer(illegal, { type: 'PLAY', index: 0 })).toBe(illegal)
    // sanity: a legal play does change state
    expect(crazyEightsReducer(s, { type: 'PLAY', index: 0 })).not.toBe(s)
  })

  it('a normal play sets the active suit and hands off to the AI', () => {
    const s = crazyEightsReducer(setup(), { type: 'PLAY', index: 0 }) // 7C
    expect(s.activeSuit).toBe('CLUBS')
    expect(s.phase).toBe('aiTurn')
    expect(s.playerHand).toHaveLength(2)
    expect(topCard(s).rank).toBe('7')
    expect(topCard(s).suit).toBe('CLUBS')
  })

  it('playing an 8 waits for a suit choice', () => {
    let s = crazyEightsReducer(setup(), { type: 'PLAY', index: 1 }) // 8D
    expect(s.phase).toBe('awaitSuit')
    s = crazyEightsReducer(s, { type: 'CHOOSE_SUIT', suit: 'SPADES' })
    expect(s.activeSuit).toBe('SPADES')
    expect(s.phase).toBe('aiTurn')
  })

  it('going out on the last card wins immediately', () => {
    const s = crazyEightsReducer(setup({ playerHand: [card('4', 'HEARTS')] }), {
      type: 'PLAY',
      index: 0,
    })
    expect(s.phase).toBe('gameover')
    expect(s.winner).toBe('player')
  })

  it('ignores DRAW and PASS while the player has a legal move', () => {
    const s = setup() // hand can play 7C, 8D, or 4H
    expect(crazyEightsReducer(s, { type: 'DRAW' })).toBe(s)
    expect(crazyEightsReducer(s, { type: 'PASS' })).toBe(s)
  })

  it('DRAW works only with no legal move, and PASS only when the deck is dead', () => {
    const stuck = setup({
      playerHand: [card('4', 'CLUBS'), card('9', 'SPADES')],
      activeSuit: 'HEARTS',
      stock: [card('5', 'DIAMONDS')],
      discard: [card('7', 'HEARTS')],
    })
    // Stock has a card, so you must draw, not pass.
    expect(crazyEightsReducer(stuck, { type: 'PASS' })).toBe(stuck)
    const drawn = crazyEightsReducer(stuck, { type: 'DRAW' })
    expect(drawn.playerHand).toHaveLength(3)

    // Now nothing left to draw -> pass is allowed.
    const dead = { ...stuck, stock: [] }
    expect(crazyEightsReducer(dead, { type: 'DRAW' })).toBe(dead)
    const passed = crazyEightsReducer(dead, { type: 'PASS' })
    expect(passed.phase).toBe('aiTurn')
    expect(passed.passStreak).toBe(1)
  })

  it('AI_STEP plays a legal card and returns the turn', () => {
    const s = crazyEightsReducer(setup({ phase: 'aiTurn' }), { type: 'AI_STEP' })
    // AI hand 9H / 2C against 7H active HEARTS -> plays 9H
    expect(topCard(s).rank).toBe('9')
    expect(s.phase).toBe('playerTurn')
    expect(s.aiHand).toHaveLength(1)
  })

  it('AI_STEP draws when it has no move', () => {
    const stuck = setup({
      phase: 'aiTurn',
      aiHand: [card('4', 'CLUBS'), card('9', 'SPADES')],
      activeSuit: 'HEARTS',
      stock: [card('5', 'DIAMONDS')],
    })
    const s = crazyEightsReducer(stuck, { type: 'AI_STEP' })
    expect(s.aiHand).toHaveLength(3)
    expect(s.phase).toBe('aiTurn')
  })

  it('AI_STEP passes when the deck is exhausted and it cannot move', () => {
    const stuck = setup({
      phase: 'aiTurn',
      aiHand: [card('4', 'CLUBS'), card('9', 'SPADES')],
      activeSuit: 'HEARTS',
      stock: [],
      discard: [card('7', 'HEARTS')],
    })
    const s = crazyEightsReducer(stuck, { type: 'AI_STEP' })
    expect(s.phase).toBe('playerTurn')
    expect(s.passStreak).toBe(1)
  })

  it('ends in a stalemate when both sides pass with a dead deck', () => {
    // Neither can move, nothing to draw.
    let s = setup({
      phase: 'playerTurn',
      playerHand: [card('4', 'CLUBS')],
      aiHand: [card('9', 'SPADES'), card('10', 'SPADES')],
      activeSuit: 'HEARTS',
      stock: [],
      discard: [card('7', 'HEARTS')],
    })
    s = crazyEightsReducer(s, { type: 'PASS' }) // player pass -> aiTurn, passStreak 1
    expect(s.phase).toBe('aiTurn')
    s = crazyEightsReducer(s, { type: 'AI_STEP' }) // AI pass -> passStreak 2 -> gameover
    expect(s.phase).toBe('gameover')
    expect(s.stalemate).toBe(true)
    expect(s.winner).toBe('player') // fewer cards (1 vs 2)
  })

  it('a successful draw between passes clears the deadlock counter', () => {
    let s = setup({
      phase: 'aiTurn',
      aiHand: [card('4', 'CLUBS')],
      activeSuit: 'HEARTS',
      stock: [],
      discard: [card('7', 'HEARTS'), card('2', 'CLUBS')],
      passStreak: 1,
    })
    // Stock is empty but the discard recycles, so the AI draws instead of passing.
    s = crazyEightsReducer(s, { type: 'AI_STEP' })
    expect(s.passStreak).toBe(0)
  })

  it('AI going out ends the game', () => {
    const s = crazyEightsReducer(
      setup({ phase: 'aiTurn', aiHand: [card('9', 'HEARTS')] }),
      { type: 'AI_STEP' },
    )
    expect(s.phase).toBe('gameover')
    expect(s.winner).toBe('ai')
  })

  it('recycles the discard pile when the stock runs dry', () => {
    const dry = setup({
      stock: [],
      discard: [card('2', 'HEARTS'), card('3', 'CLUBS'), card('7', 'HEARTS')],
      playerHand: [card('9', 'SPADES')],
      activeSuit: 'HEARTS',
    })
    const s = crazyEightsReducer(dry, { type: 'DRAW' })
    expect(s.playerHand).toHaveLength(2) // drew one
    expect(s.discard).toHaveLength(1) // recycled down to the top card
    expect(s.stock.length).toBe(1) // 2 recycled, 1 drawn
  })
})
