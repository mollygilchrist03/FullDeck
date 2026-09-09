import { describe, expect, it } from 'vitest'
import { chooseAiPlay, isPlayable, playableCards, strongestSuit, SUITS } from './crazyEightsLogic'
import {
  canDraw,
  crazyEightsReducer,
  HAND_SIZE,
  initCrazyEights,
  seatHasMove,
  topCard,
  type CrazyEightsState,
} from './crazyEightsReducer'
import { card, shuffledDeck } from '../../test/helpers'

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

/** Seat 0 = "you", seat 1 = "the AI" unless overridden. */
const setup = (over: Partial<CrazyEightsState> = {}): CrazyEightsState => ({
  ...crazyEightsReducer(initCrazyEights(2), {
    type: 'START',
    stock: [card('2', 'SPADES'), card('3', 'SPADES')],
    discard: [card('7', 'HEARTS')],
    hands: [
      [card('7', 'CLUBS'), card('8', 'DIAMONDS'), card('4', 'HEARTS')],
      [card('9', 'HEARTS'), card('2', 'CLUBS')],
    ],
    activeSuit: 'HEARTS',
  }),
  ...over,
})

describe('crazyEightsReducer', () => {
  it('START deals into the first seat\'s turn', () => {
    const s = setup()
    expect(s.phase).toBe('turn')
    expect(s.turn).toBe(0)
    expect(topCard(s).rank).toBe('7')
    expect(s.activeSuit).toBe('HEARTS')
  })

  it('rejects an unplayable card', () => {
    // index 0 is 7C — plays on rank. index 2 is 4H — plays on suit. Make an illegal one:
    const illegal = setup({ hands: [[card('5', 'CLUBS'), card('4', 'HEARTS')], []] })
    expect(crazyEightsReducer(illegal, { type: 'PLAY', index: 0 })).toBe(illegal)
    // sanity: a legal play does change state
    const s = setup()
    expect(crazyEightsReducer(s, { type: 'PLAY', index: 0 })).not.toBe(s)
  })

  it('a normal play sets the active suit and hands off to the next seat', () => {
    const s = crazyEightsReducer(setup(), { type: 'PLAY', index: 0 }) // 7C
    expect(s.activeSuit).toBe('CLUBS')
    expect(s.turn).toBe(1)
    expect(s.hands[0]).toHaveLength(2)
    expect(topCard(s).rank).toBe('7')
    expect(topCard(s).suit).toBe('CLUBS')
  })

  it('playing an 8 waits for a suit choice', () => {
    let s = crazyEightsReducer(setup(), { type: 'PLAY', index: 1 }) // 8D
    expect(s.phase).toBe('awaitSuit')
    s = crazyEightsReducer(s, { type: 'CHOOSE_SUIT', suit: 'SPADES' })
    expect(s.activeSuit).toBe('SPADES')
    expect(s.turn).toBe(1)
  })

  it('going out on the last card wins immediately', () => {
    const s = crazyEightsReducer(setup({ hands: [[card('4', 'HEARTS')], [card('9', 'HEARTS')]] }), {
      type: 'PLAY',
      index: 0,
    })
    expect(s.phase).toBe('gameover')
    expect(s.winner).toBe(0)
  })

  it('ignores DRAW and PASS while the seat has a legal move', () => {
    const s = setup() // hand can play 7C, 8D, or 4H
    expect(crazyEightsReducer(s, { type: 'DRAW' })).toBe(s)
    expect(crazyEightsReducer(s, { type: 'PASS' })).toBe(s)
  })

  it('DRAW works only with no legal move, and PASS only when the deck is dead', () => {
    const stuck = setup({
      hands: [[card('4', 'CLUBS'), card('9', 'SPADES')], [card('9', 'HEARTS'), card('2', 'CLUBS')]],
      activeSuit: 'HEARTS',
      stock: [card('5', 'DIAMONDS')],
      discard: [card('7', 'HEARTS')],
    })
    // Stock has a card, so you must draw, not pass.
    expect(crazyEightsReducer(stuck, { type: 'PASS' })).toBe(stuck)
    const drawn = crazyEightsReducer(stuck, { type: 'DRAW' })
    expect(drawn.hands[0]).toHaveLength(3)

    // Now nothing left to draw -> pass is allowed.
    const dead = { ...stuck, stock: [] }
    expect(crazyEightsReducer(dead, { type: 'DRAW' })).toBe(dead)
    const passed = crazyEightsReducer(dead, { type: 'PASS' })
    expect(passed.turn).toBe(1)
    expect(passed.passStreak).toBe(1)
  })

  it('AI_STEP plays a legal card and returns the turn', () => {
    const s = crazyEightsReducer(setup({ turn: 1 }), { type: 'AI_STEP' })
    // seat 1's hand 9H / 2C against 7H active HEARTS -> plays 9H
    expect(topCard(s).rank).toBe('9')
    expect(s.turn).toBe(0)
    expect(s.hands[1]).toHaveLength(1)
  })

  it('AI_STEP draws when it has no move', () => {
    const stuck = setup({
      turn: 1,
      hands: [[card('7', 'CLUBS')], [card('4', 'CLUBS'), card('9', 'SPADES')]],
      activeSuit: 'HEARTS',
      stock: [card('5', 'DIAMONDS')],
    })
    const s = crazyEightsReducer(stuck, { type: 'AI_STEP' })
    expect(s.hands[1]).toHaveLength(3)
    expect(s.turn).toBe(1)
  })

  it('AI_STEP passes when the deck is exhausted and it cannot move', () => {
    const stuck = setup({
      turn: 1,
      hands: [[card('7', 'CLUBS')], [card('4', 'CLUBS'), card('9', 'SPADES')]],
      activeSuit: 'HEARTS',
      stock: [],
      discard: [card('7', 'HEARTS')],
    })
    const s = crazyEightsReducer(stuck, { type: 'AI_STEP' })
    expect(s.turn).toBe(0)
    expect(s.passStreak).toBe(1)
  })

  it('ends in a stalemate when every seat passes with a dead deck', () => {
    // Neither can move, nothing to draw.
    let s = setup({
      turn: 0,
      hands: [[card('4', 'CLUBS')], [card('9', 'SPADES'), card('10', 'SPADES')]],
      activeSuit: 'HEARTS',
      stock: [],
      discard: [card('7', 'HEARTS')],
    })
    s = crazyEightsReducer(s, { type: 'PASS' }) // seat 0 passes -> seat 1's turn, passStreak 1
    expect(s.turn).toBe(1)
    s = crazyEightsReducer(s, { type: 'AI_STEP' }) // seat 1 passes -> passStreak 2 (== seatCount) -> gameover
    expect(s.phase).toBe('gameover')
    expect(s.stalemate).toBe(true)
    expect(s.winner).toBe(0) // fewer cards (1 vs 2)
  })

  it('a successful draw between passes clears the deadlock counter', () => {
    let s = setup({
      turn: 1,
      hands: [[card('7', 'CLUBS'), card('8', 'DIAMONDS'), card('4', 'HEARTS')], [card('4', 'CLUBS')]],
      activeSuit: 'HEARTS',
      stock: [],
      discard: [card('7', 'HEARTS'), card('2', 'CLUBS')],
      passStreak: 1,
    })
    // Stock is empty but the discard recycles, so seat 1 draws instead of passing.
    s = crazyEightsReducer(s, { type: 'AI_STEP' })
    expect(s.passStreak).toBe(0)
  })

  it('the AI going out ends the game', () => {
    const s = crazyEightsReducer(
      setup({ turn: 1, hands: [[card('7', 'CLUBS'), card('8', 'DIAMONDS'), card('4', 'HEARTS')], [card('9', 'HEARTS')]] }),
      { type: 'AI_STEP' },
    )
    expect(s.phase).toBe('gameover')
    expect(s.winner).toBe(1)
  })

  it('recycles the discard pile when the stock runs dry', () => {
    const dry = setup({
      stock: [],
      discard: [card('2', 'HEARTS'), card('3', 'CLUBS'), card('7', 'HEARTS')],
      hands: [[card('9', 'SPADES')], [card('9', 'HEARTS'), card('2', 'CLUBS')]],
      activeSuit: 'HEARTS',
    })
    const s = crazyEightsReducer(dry, { type: 'DRAW' })
    expect(s.hands[0]).toHaveLength(2) // drew one
    expect(s.discard).toHaveLength(1) // recycled down to the top card
    expect(s.stock.length).toBe(1) // 2 recycled, 1 drawn
  })

  it('every 2-seat deal plays to a finish — no stuck state (fuzz, 300 random games)', () => {
    for (let game = 0; game < 300; game += 1) {
      const d = shuffledDeck()
      const hands = [d.slice(0, HAND_SIZE), d.slice(HAND_SIZE, HAND_SIZE * 2)]
      const rest = d.slice(HAND_SIZE * 2)
      const starterIdx = Math.max(0, rest.findIndex((c) => c.rank !== '8'))
      let s = crazyEightsReducer(initCrazyEights(2), {
        type: 'START',
        stock: rest.filter((_, i) => i !== starterIdx),
        discard: [rest[starterIdx]],
        hands,
        activeSuit: rest[starterIdx].suit,
      })
      let steps = 0
      while (s.phase !== 'gameover' && steps < 3000) {
        steps += 1
        if (s.turn === 1 || (s.phase === 'awaitSuit' && s.wildSeat === 1)) {
          s = crazyEightsReducer(s, { type: 'AI_STEP' })
        } else if (s.phase === 'awaitSuit') {
          s = crazyEightsReducer(s, { type: 'CHOOSE_SUIT', suit: SUITS[game % 4] })
        } else if (seatHasMove(s, 0)) {
          const legal = playableCards(s.hands[0], topCard(s), s.activeSuit)
          const idx = s.hands[0].findIndex((c) => c.code === legal[0].code)
          s = crazyEightsReducer(s, { type: 'PLAY', index: idx })
        } else if (canDraw(s)) {
          s = crazyEightsReducer(s, { type: 'DRAW' })
        } else {
          s = crazyEightsReducer(s, { type: 'PASS' })
        }
      }
      expect(s.phase).toBe('gameover')
      expect(s.winner).not.toBeNull()
    }
  })

  it('every 6-seat deal plays to a finish — no stuck state (fuzz, 100 random games)', () => {
    const SEATS = 6
    for (let game = 0; game < 100; game += 1) {
      const d = shuffledDeck()
      const hands: (typeof d)[] = []
      for (let i = 0; i < SEATS; i += 1) hands.push(d.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE))
      const rest = d.slice(SEATS * HAND_SIZE)
      const starterIdx = Math.max(0, rest.findIndex((c) => c.rank !== '8'))
      let s = crazyEightsReducer(initCrazyEights(SEATS), {
        type: 'START',
        stock: rest.filter((_, i) => i !== starterIdx),
        discard: [rest[starterIdx]],
        hands,
        activeSuit: rest[starterIdx].suit,
      })
      let steps = 0
      while (s.phase !== 'gameover' && steps < 6000) {
        steps += 1
        if (s.phase === 'awaitSuit') {
          s = crazyEightsReducer(s, { type: 'CHOOSE_SUIT', suit: SUITS[game % 4], seat: s.wildSeat! })
        } else if (seatHasMove(s, s.turn)) {
          const legal = playableCards(s.hands[s.turn], topCard(s), s.activeSuit)
          const idx = s.hands[s.turn].findIndex((c) => c.code === legal[0].code)
          s = crazyEightsReducer(s, { type: 'PLAY', index: idx, seat: s.turn })
        } else if (canDraw(s)) {
          s = crazyEightsReducer(s, { type: 'DRAW', seat: s.turn })
        } else {
          s = crazyEightsReducer(s, { type: 'PASS', seat: s.turn })
        }
      }
      expect(s.phase).toBe('gameover')
      expect(s.winner).not.toBeNull()
      const totalCards = s.hands.reduce((sum, h) => sum + h.length, 0) + s.stock.length + s.discard.length
      expect(totalCards).toBe(52)
    }
  })
})
