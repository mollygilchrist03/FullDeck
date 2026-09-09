import { describe, expect, it } from 'vitest'
import { chooseAiAsk, ranksIn, takeBooks } from './goFishLogic'
import { goFishReducer, initGoFish, type GoFishState } from './goFishReducer'
import { hand, shuffledDeck } from '../../test/helpers'

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

/** Seat 0 = "you", seat 1 = "the dealer" for 2-seat setups. */
const seed = (over: Partial<GoFishState> = {}): GoFishState => ({
  ...goFishReducer(initGoFish(2), {
    type: 'START',
    hands: [hand('3', '5', '9'), hand('3', '3', '7')],
    stock: hand('KING', '9', '3'),
  }),
  ...over,
})

describe('goFishReducer', () => {
  it('START pulls any books already dealt', () => {
    const s = goFishReducer(initGoFish(2), {
      type: 'START',
      hands: [hand('4', '4', '4', '4', '2'), hand('7')],
      stock: [],
    })
    expect(s.books[0]).toEqual(['4'])
    expect(s.hands[0]).toHaveLength(1)
  })

  it("the AI only remembers the player's last two asks, not every rank forever", () => {
    // Player holds one each of 3, 5, 9 — ask for all three in turn (each a
    // miss followed by a draw so the turn comes back).
    let s = seed({
      hands: [hand('3', '5', '9'), hand('KING')],
      stock: hand('2', '4', '6', '8', '10'),
    })
    for (const rank of ['3', '5', '9'] as const) {
      s = goFishReducer(s, { type: 'ASK', rank, target: 1 })
      s = goFishReducer(s, { type: 'DRAW' }) // go fish, turn passes to AI
      s = goFishReducer(s, { type: 'AI_STEP' }) // AI asks (has only a KING → miss)
      s = goFishReducer(s, { type: 'AI_STEP' }) // AI draws, turn back to player
    }
    // The 3 (asked first, three turns ago) has fallen out of memory.
    expect(s.knownPlayerRanks).not.toContain('3')
    expect(s.knownPlayerRanks.length).toBeLessThanOrEqual(2)
  })

  it('the AI drops a remembered rank once it asks for it', () => {
    const s = goFishReducer(
      seed({
        hands: [hand('7', '2'), hand('7', 'KING')],
        stock: hand('4', '5'),
        phase: 'ask',
        turn: 1,
        knownPlayerRanks: ['7'],
      }),
      { type: 'AI_STEP' }, // AI asks for the remembered 7 (a hit)
    )
    expect(s.knownPlayerRanks).not.toContain('7')
  })

  it('a hit transfers every matching card and keeps the turn', () => {
    const s = goFishReducer(seed(), { type: 'ASK', rank: '3', target: 1 })
    expect(s.hands[0].filter((c) => c.rank === '3')).toHaveLength(3)
    expect(s.hands[1].some((c) => c.rank === '3')).toBe(false)
    expect(s.phase).toBe('ask')
    expect(s.turn).toBe(0)
  })

  it('rejects asking yourself or a seat that does not exist', () => {
    const s = seed()
    expect(goFishReducer(s, { type: 'ASK', rank: '3', target: 0 })).toBe(s)
    expect(goFishReducer(s, { type: 'ASK', rank: '3', target: 5 })).toBe(s)
  })

  it('a miss sends you to a draw you have to click, then passes the turn', () => {
    let s = goFishReducer(seed(), { type: 'ASK', rank: '5', target: 1 }) // AI has no 5s
    expect(s.phase).toBe('draw')
    expect(s.turn).toBe(0)
    expect(s.pendingRank).toBe('5')
    expect(s.hands[0]).toHaveLength(3) // not drawn yet
    s = goFishReducer(s, { type: 'DRAW' })
    expect(s.hands[0]).toHaveLength(4) // drew the KING
    expect(s.phase).toBe('ask')
    expect(s.turn).toBe(1)
  })

  it('fishing exactly what you asked for lets you go again', () => {
    let s = goFishReducer(seed({ stock: hand('9', 'KING') }), { type: 'ASK', rank: '9', target: 1 })
    expect(s.phase).toBe('draw')
    s = goFishReducer(s, { type: 'DRAW' }) // top of stock is a 9
    expect(s.phase).toBe('ask')
    expect(s.turn).toBe(0)
    expect(s.hands[0].filter((c) => c.rank === '9')).toHaveLength(2)
  })

  it('AI_STEP takes from the player on a hit and steps again', () => {
    const s = goFishReducer(seed({ phase: 'ask', turn: 1 }), { type: 'AI_STEP' })
    // AI holds two 3s; player holds one 3 -> AI takes it, stays its turn.
    expect(s.hands[1].filter((c) => c.rank === '3')).toHaveLength(3)
    expect(s.phase).toBe('ask')
    expect(s.turn).toBe(1)
    expect(s.aiSteps).toBe(1)
  })

  it('an empty-handed player draws up from the stock instead of stalling', () => {
    // AI clears the player's hand, then misses and fishes; the turn returns to
    // an empty player, who must draw up.
    let s = seed({
      phase: 'ask',
      turn: 1,
      hands: [hand('3'), hand('3', '3')],
      stock: hand('9', 'KING'),
    })
    s = goFishReducer(s, { type: 'AI_STEP' }) // takes the player's 3
    expect(s.hands[0]).toHaveLength(0)
    s = goFishReducer(s, { type: 'AI_STEP' }) // asks again, misses -> aiDraw
    expect(s.phase).toBe('draw')
    expect(s.turn).toBe(1)
    s = goFishReducer(s, { type: 'AI_STEP' }) // AI fishes a 9 (no match) -> turn to empty player
    expect(s.phase).toBe('draw')
    expect(s.turn).toBe(0)
    expect(s.pendingRank).toBeNull()
    s = goFishReducer(s, { type: 'DRAW' })
    expect(s.phase).toBe('ask')
    expect(s.turn).toBe(0)
    expect(s.hands[0].length).toBeGreaterThan(0)
  })

  it('ends the game if every card is gone even below thirteen books', () => {
    const s = goFishReducer(initGoFish(2), {
      type: 'START',
      hands: [hand('4', '4', '4', '4'), []],
      stock: [],
    })
    expect(s.phase).toBe('gameover')
    expect(s.winner).toBe(0)
  })

  it('ends when all thirteen books are made', () => {
    const almost = seed({
      books: [['2', '3', '4', '5', '6', '7'], ['8', '9', '10', 'JACK', 'QUEEN', 'KING']],
      hands: [hand('ACE', 'ACE', 'ACE'), hand('ACE')],
      stock: [],
    })
    const s = goFishReducer(almost, { type: 'ASK', rank: 'ACE', target: 1 })
    expect(s.phase).toBe('gameover')
    expect(s.winner).toBe(0)
    expect(s.books[0]).toContain('ACE')
  })

  it('3-way: asking a specific seat only takes from that seat', () => {
    let s = goFishReducer(initGoFish(3), {
      type: 'START',
      hands: [hand('3', '5'), hand('3', '9'), hand('3', '7')],
      stock: [],
    })
    s = goFishReducer(s, { type: 'ASK', rank: '3', target: 2, seat: 0 })
    expect(s.hands[0].filter((c) => c.rank === '3')).toHaveLength(2)
    expect(s.hands[2].some((c) => c.rank === '3')).toBe(false)
    expect(s.hands[1].some((c) => c.rank === '3')).toBe(true) // untouched — wasn't asked
  })

  it('every 2-seat deal plays to a finish — no stuck state (fuzz, 400 random games)', () => {
    for (let game = 0; game < 400; game += 1) {
      const d = shuffledDeck()
      let s = goFishReducer(initGoFish(2), {
        type: 'START',
        hands: [d.slice(0, 7), d.slice(7, 14)],
        stock: d.slice(14),
      })
      let steps = 0
      while (s.phase !== 'gameover' && steps < 5000) {
        steps += 1
        if (s.phase === 'ask' && s.turn === 0) {
          const opts = ranksIn(s.hands[0])
          s = goFishReducer(s, { type: 'ASK', rank: opts[Math.floor(Math.random() * opts.length)], target: 1 })
        } else if (s.phase === 'draw' && s.turn === 0) {
          s = goFishReducer(s, { type: 'DRAW' })
        } else {
          s = goFishReducer(s, { type: 'AI_STEP' })
        }
      }
      expect(s.phase).toBe('gameover')
      expect(s.books[0].length + s.books[1].length).toBe(13)
    }
  })

  it('every 6-seat deal plays to a finish — no stuck state (fuzz, 100 random games)', () => {
    const SEATS = 6
    for (let game = 0; game < 100; game += 1) {
      const d = shuffledDeck()
      const hands: (typeof d)[] = []
      for (let i = 0; i < SEATS; i += 1) hands.push(d.slice(i * 7, (i + 1) * 7))
      let s = goFishReducer(initGoFish(SEATS), { type: 'START', hands, stock: d.slice(SEATS * 7) })
      let steps = 0
      while (s.phase !== 'gameover' && steps < 8000) {
        steps += 1
        if (s.phase === 'ask') {
          const seat = s.turn
          const opts = ranksIn(s.hands[seat])
          const targets = s.hands.map((_, i) => i).filter((i) => i !== seat)
          const target = targets[Math.floor(Math.random() * targets.length)]
          s = goFishReducer(s, { type: 'ASK', rank: opts[Math.floor(Math.random() * opts.length)], target, seat })
        } else {
          s = goFishReducer(s, { type: 'DRAW', seat: s.turn })
        }
      }
      expect(s.phase).toBe('gameover')
      const totalBooks = s.books.reduce((sum, b) => sum + b.length, 0)
      const totalCards = s.hands.reduce((sum, h) => sum + h.length, 0) + s.stock.length
      expect(totalBooks * 4 + totalCards).toBe(52)
      expect(s.winner).not.toBeNull()
    }
  })
})
