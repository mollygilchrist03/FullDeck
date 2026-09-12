import { describe, expect, it } from 'vitest'
import { firstOpenSlot, isLayoutComplete, placementFor } from './trashLogic'
import { initTrash, trashReducer, type TrashState } from './trashReducer'
import { card, hand, shuffledDeck } from '../../test/helpers'
import type { Card } from '../../types/card'

describe('placementFor', () => {
  it('maps aces through tens to slots', () => {
    expect(placementFor(card('ACE'), 10)).toBe(0)
    expect(placementFor(card('5'), 10)).toBe(4)
    expect(placementFor(card('10'), 10)).toBe(9)
  })
  it('queens are wild, jacks and kings are dead', () => {
    expect(placementFor(card('QUEEN'), 10)).toBe('wild')
    expect(placementFor(card('JACK'), 10)).toBe('dead')
    expect(placementFor(card('KING'), 10)).toBe('dead')
  })
  it('a number past the layout size is dead', () => {
    expect(placementFor(card('9'), 5)).toBe('dead')
  })
})

describe('slot helpers', () => {
  it('firstOpenSlot / isLayoutComplete', () => {
    const slots = [{ locked: card('ACE') }, { locked: null }, { locked: card('3') }]
    expect(firstOpenSlot(slots)).toBe(1)
    expect(isLayoutComplete(slots)).toBe(false)
    expect(isLayoutComplete([{ locked: card('ACE') }])).toBe(true)
  })
})

const deadLayout = (n: number): Card[] => hand(...Array.from({ length: n }, () => 'KING' as const))

/** Seat 0 = "you", seat 1 = "the dealer" for 2-seat setups. */
const start = (stock: Card[], playerN = 10, aiN = 10): TrashState =>
  trashReducer(initTrash(2), {
    type: 'START',
    stock,
    faceDown: [deadLayout(playerN), deadLayout(aiN)],
  })

describe('trashReducer', () => {
  it('START lays out every seat face down', () => {
    const s = start([card('ACE')])
    expect(s.slots[0]).toHaveLength(10)
    expect(s.slots[0].every((sl) => sl.locked === null)).toBe(true)
    expect(s.phase).toBe('turn')
    expect(s.turn).toBe(0)
  })

  it('drawing a positional card locks its slot', () => {
    const s = trashReducer(start([card('ACE')]), { type: 'DRAW' })
    // ace -> slot 1; the swapped-up card is a King (dead) so the turn ends.
    expect(s.slots[0][0].locked?.rank).toBe('ACE')
    expect(s.phase).toBe('turn')
    expect(s.turn).toBe(1)
    expect(s.turnsTaken).toBe(1)
    expect(s.discard.at(-1)?.rank).toBe('KING')
  })

  it('drawing a dead card just ends the turn', () => {
    const s = trashReducer(start([card('KING')]), { type: 'DRAW' })
    expect(s.phase).toBe('turn')
    expect(s.turn).toBe(1)
    expect(s.slots[0].every((sl) => sl.locked === null)).toBe(true)
  })

  it('ordinary consecutive dead draws (plenty of stock left) do not end the round', () => {
    // Regression: dead cards (J/K) are a routine, constant part of real play
    // and must never count toward the dead-deck tiebreak — only a genuine
    // "nothing left to draw" should.
    let s = start([card('KING'), card('JACK'), card('KING'), card('JACK')])
    s = trashReducer(s, { type: 'DRAW' }) // seat 0 draws dead
    s = trashReducer(s, { type: 'DRAW', seat: 1 }) // seat 1 draws dead
    expect(s.phase).toBe('turn')
    expect(s.roundWinner).toBeNull()
    expect(s.stalePasses).toBe(0)
  })

  it('a queen asks the acting seat to choose a slot', () => {
    let s = trashReducer(start([card('QUEEN')]), { type: 'DRAW' })
    expect(s.phase).toBe('wildChoice')
    s = trashReducer(s, { type: 'PLACE_WILD', slot: 3 })
    expect(s.slots[0][3].locked?.rank).toBe('QUEEN')
  })

  it('completing a one-card layout wins the match', () => {
    const s = trashReducer(start([card('ACE')], 1, 2), { type: 'DRAW' })
    expect(s.phase).toBe('gameover')
    expect(s.matchWinner).toBe(0)
  })

  it('a dead deck for everyone ends the round for the fuller layout', () => {
    const open = { faceDown: card('2'), locked: null }
    const done = { faceDown: card('2'), locked: card('ACE') }
    let s: TrashState = {
      ...initTrash(2),
      phase: 'turn',
      turn: 0,
      slots: [
        [open, open],
        [done, open], // seat 1 has fewer open slots
      ],
      sizes: [2, 2],
      stock: [],
      discard: [card('KING')],
    }
    s = trashReducer(s, { type: 'DRAW' }) // nothing to draw -> forced pass
    expect(s.stalePasses).toBe(1)
    expect(s.phase).toBe('turn')
    expect(s.turn).toBe(1)
    s = trashReducer(s, { type: 'AI_STEP' }) // second forced pass -> resolve
    expect(s.phase).toBe('roundOver')
    expect(s.roundWinner).toBe(1)
  })

  it('clearing a bigger layout ends the round and shrinks the winner', () => {
    // size 2: draw an ace (slot 1) then a 2 (slot 2). Face-down cards are the 2 and ace.
    let s = trashReducer(initTrash(2), {
      type: 'START',
      stock: [card('ACE'), card('2')],
      faceDown: [[card('2'), card('ACE')], deadLayout(2)], // slot 0 hides a 2, slot 1 hides an ace
    })
    s = trashReducer(s, { type: 'DRAW' }) // ace -> slot0 locks, swap up the 2 -> slot1 locks -> complete
    expect(s.phase).toBe('roundOver')
    expect(s.roundWinner).toBe(0)
    s = trashReducer(s, {
      type: 'NEXT_ROUND',
      stock: [],
      faceDown: [deadLayout(1), deadLayout(2)],
    })
    expect(s.sizes[0]).toBe(1)
    expect(s.round).toBe(2)
  })

  it('every solo match plays to a finish — no stuck state (fuzz, 200 random matches)', () => {
    const deal = (pN: number, aN: number) => {
      const d = shuffledDeck()
      return { faceDown: [d.slice(0, pN), d.slice(pN, pN + aN)], stock: d.slice(pN + aN) }
    }
    for (let game = 0; game < 200; game += 1) {
      let s = trashReducer(initTrash(2), { type: 'START', ...deal(10, 10) })
      let steps = 0
      while (s.phase !== 'gameover' && steps < 8000) {
        steps += 1
        if (s.phase === 'turn' && s.turn === 1) {
          s = trashReducer(s, { type: 'AI_STEP' })
        } else if (s.phase === 'wildChoice') {
          const slots = s.slots[s.turn]
          s = trashReducer(s, { type: 'PLACE_WILD', slot: Math.max(0, firstOpenSlot(slots)), seat: s.turn })
        } else if (s.phase === 'roundOver') {
          const pN = s.roundWinner === 0 ? s.sizes[0] - 1 : s.sizes[0]
          const aN = s.roundWinner === 1 ? s.sizes[1] - 1 : s.sizes[1]
          s = trashReducer(s, { type: 'NEXT_ROUND', ...deal(pN, aN) })
        } else {
          s = trashReducer(s, { type: Math.random() < 0.7 ? 'DRAW' : 'TAKE_DISCARD' })
        }
      }
      expect(s.phase).toBe('gameover')
      expect(s.matchWinner).not.toBeNull()
    }
  })

  it('every 4-seat online match plays to a finish — no stuck state (fuzz, 5 random matches)', () => {
    const SEATS = 4
    for (let game = 0; game < 5; game += 1) {
      const d = shuffledDeck()
      const faceDown: Card[][] = []
      for (let i = 0; i < SEATS; i += 1) faceDown.push(d.slice(i * 10, (i + 1) * 10))
      let s: TrashState = {
        ...trashReducer(initTrash(SEATS), { type: 'START', stock: d.slice(SEATS * 10), faceDown }),
        soloLadder: false, // online mode: first cleared row wins outright
      }
      // Taking the discard whenever it's actually useful — the same check
      // AI_STEP uses — is how any sensible player behaves. Pure-random play
      // with 4 seats sharing one deck can rack up a long tail before
      // converging purely by chance (a real player isn't literally random
      // for hundreds of thousands of turns), so this budget is generous on
      // purpose and the game count small, not evidence of a stuck game.
      let steps = 0
      while (s.phase !== 'gameover' && steps < 2_000_000) {
        steps += 1
        if (s.phase === 'wildChoice') {
          const slots = s.slots[s.turn]
          s = trashReducer(s, { type: 'PLACE_WILD', slot: Math.max(0, firstOpenSlot(slots)), seat: s.turn })
        } else {
          const top = s.discard[s.discard.length - 1]
          const useful =
            top !== undefined &&
            (() => {
              const w = placementFor(top, s.sizes[s.turn])
              return w === 'wild' || (typeof w === 'number' && !s.slots[s.turn][w].locked)
            })()
          s = trashReducer(s, { type: useful ? 'TAKE_DISCARD' : 'DRAW', seat: s.turn })
        }
      }
      expect(s.phase).toBe('gameover')
      expect(s.matchWinner).not.toBeNull()
      const totalCards =
        s.slots.reduce((sum, row) => sum + row.length, 0) + s.stock.length + s.discard.length
      expect(totalCards).toBe(52) // the whole deck, not just what was dealt into rows
    }
  })
})
