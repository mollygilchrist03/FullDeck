import { describe, expect, it } from 'vitest'
import { firstOpenSlot, isLayoutComplete, placementFor } from './trashLogic'
import { initTrash, trashReducer, type TrashState } from './trashReducer'
import { card, hand } from '../../test/helpers'
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

const start = (stock: Card[], playerN = 10, aiN = 10): TrashState =>
  trashReducer(initTrash(), {
    type: 'START',
    stock,
    playerFaceDown: deadLayout(playerN),
    aiFaceDown: deadLayout(aiN),
  })

describe('trashReducer', () => {
  it('START lays out both sides face down', () => {
    const s = start([card('ACE')])
    expect(s.playerSlots).toHaveLength(10)
    expect(s.playerSlots.every((sl) => sl.locked === null)).toBe(true)
    expect(s.phase).toBe('playerTurn')
  })

  it('drawing a positional card locks its slot', () => {
    const s = trashReducer(start([card('ACE')]), { type: 'DRAW' })
    // ace -> slot 1; the swapped-up card is a King (dead) so the turn ends.
    expect(s.playerSlots[0].locked?.rank).toBe('ACE')
    expect(s.phase).toBe('aiTurn')
    expect(s.playerTurns).toBe(1)
    expect(s.discard.at(-1)?.rank).toBe('KING')
  })

  it('drawing a dead card just ends the turn', () => {
    const s = trashReducer(start([card('KING')]), { type: 'DRAW' })
    expect(s.phase).toBe('aiTurn')
    expect(s.playerSlots.every((sl) => sl.locked === null)).toBe(true)
  })

  it('a queen asks the player to choose a slot', () => {
    let s = trashReducer(start([card('QUEEN')]), { type: 'DRAW' })
    expect(s.phase).toBe('wildChoice')
    s = trashReducer(s, { type: 'PLACE_WILD', slot: 3 })
    expect(s.playerSlots[3].locked?.rank).toBe('QUEEN')
  })

  it('completing a one-card layout wins the match', () => {
    const s = trashReducer(start([card('ACE')], 1, 2), { type: 'DRAW' })
    expect(s.phase).toBe('gameover')
    expect(s.matchWinner).toBe('player')
  })

  it('clearing a bigger layout ends the round and shrinks the winner', () => {
    // size 2: draw an ace (slot 1) then a 2 (slot 2). Face-down cards are the 2 and ace.
    let s = trashReducer(initTrash(), {
      type: 'START',
      stock: [card('ACE'), card('2')],
      playerFaceDown: [card('2'), card('ACE')], // slot 0 hides a 2, slot 1 hides an ace
      aiFaceDown: deadLayout(2),
    })
    s = trashReducer(s, { type: 'DRAW' }) // ace -> slot0 locks, swap up the 2 -> slot1 locks -> complete
    expect(s.phase).toBe('roundOver')
    expect(s.roundWinner).toBe('player')
    s = trashReducer(s, {
      type: 'NEXT_ROUND',
      stock: [],
      playerFaceDown: deadLayout(1),
      aiFaceDown: deadLayout(2),
    })
    expect(s.playerSize).toBe(1)
    expect(s.round).toBe(2)
  })
})
