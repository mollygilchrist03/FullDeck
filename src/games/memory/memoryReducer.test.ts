import { describe, expect, it } from 'vitest'
import { initMemory, memoryReducer, type MemoryState } from './memoryReducer'
import type { Tile } from './memoryLogic'

// Fixed 4-tile board: two pairs (AS / KH).
const tiles: Tile[] = [
  { id: 0, code: 'AS', image: '' },
  { id: 1, code: 'AS', image: '' },
  { id: 2, code: 'KH', image: '' },
  { id: 3, code: 'KH', image: '' },
]

const playing = (): MemoryState =>
  memoryReducer(initMemory(4), { type: 'START', tiles })

describe('memoryReducer', () => {
  it('START puts the board into play', () => {
    const s = playing()
    expect(s.status).toBe('playing')
    expect(s.tiles).toHaveLength(4)
    expect(s.moves).toBe(0)
  })

  it('flips one card without counting a move', () => {
    const s = memoryReducer(playing(), { type: 'FLIP', id: 0 })
    expect(s.flipped).toEqual([0])
    expect(s.moves).toBe(0)
    expect(s.lock).toBe(false)
  })

  it('keeps a matched pair face-up and pulses it', () => {
    let s = playing()
    s = memoryReducer(s, { type: 'FLIP', id: 0 })
    s = memoryReducer(s, { type: 'FLIP', id: 1 })
    expect(s.matched).toEqual([0, 1])
    expect(s.flipped).toEqual([])
    expect(s.justMatched).toEqual([0, 1])
    expect(s.moves).toBe(1)
    expect(s.lock).toBe(false)
  })

  it('locks the board on a mismatch until RESOLVE', () => {
    let s = playing()
    s = memoryReducer(s, { type: 'FLIP', id: 0 })
    s = memoryReducer(s, { type: 'FLIP', id: 2 })
    expect(s.lock).toBe(true)
    expect(s.flipped).toEqual([0, 2])
    expect(s.moves).toBe(1)

    // A third click mid-comparison is ignored.
    const blocked = memoryReducer(s, { type: 'FLIP', id: 3 })
    expect(blocked).toBe(s)

    const resolved = memoryReducer(s, { type: 'RESOLVE' })
    expect(resolved.lock).toBe(false)
    expect(resolved.flipped).toEqual([])
  })

  it('ignores re-flipping an already-flipped or matched card', () => {
    let s = playing()
    s = memoryReducer(s, { type: 'FLIP', id: 0 })
    expect(memoryReducer(s, { type: 'FLIP', id: 0 })).toBe(s)
    s = memoryReducer(s, { type: 'FLIP', id: 1 }) // match 0/1
    expect(memoryReducer(s, { type: 'FLIP', id: 0 })).toBe(s)
  })

  it('reaches "won" once every pair is matched', () => {
    let s = playing()
    s = memoryReducer(s, { type: 'FLIP', id: 0 })
    s = memoryReducer(s, { type: 'FLIP', id: 1 })
    s = memoryReducer(s, { type: 'FLIP', id: 2 })
    s = memoryReducer(s, { type: 'FLIP', id: 3 })
    expect(s.status).toBe('won')
    expect(s.moves).toBe(2)
  })

  it('SET_DIFFICULTY resets to an idle board of the new size', () => {
    const s = memoryReducer(playing(), { type: 'SET_DIFFICULTY', size: 6 })
    expect(s.gridSize).toBe(6)
    expect(s.status).toBe('idle')
    expect(s.tiles).toEqual([])
  })
})
