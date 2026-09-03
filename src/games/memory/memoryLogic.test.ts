import { describe, expect, it } from 'vitest'
import { buildBoard, isMatch, isWin, type Tile } from './memoryLogic'
import { card } from '../../test/helpers'

const identity = <T,>(x: T[]) => x
const deck = [
  card('ACE', 'SPADES'),
  card('KING', 'HEARTS'),
  card('QUEEN', 'DIAMONDS'),
  card('JACK', 'CLUBS'),
]

describe('buildBoard', () => {
  it('produces two tiles per pair', () => {
    const board = buildBoard(deck, 3, identity)
    expect(board).toHaveLength(6)
  })

  it('gives every code exactly two tiles, with unique ids', () => {
    const board = buildBoard(deck, 4, identity)
    const byCode = new Map<string, number>()
    for (const t of board) byCode.set(t.code, (byCode.get(t.code) ?? 0) + 1)
    expect([...byCode.values()]).toEqual([2, 2, 2, 2])
    expect(new Set(board.map((t) => t.id)).size).toBe(board.length)
  })

  it('throws if there are not enough cards', () => {
    expect(() => buildBoard(deck, 5, identity)).toThrow()
  })

  it('uses the injected shuffle', () => {
    const reverse = <T,>(x: T[]) => [...x].reverse()
    const board = buildBoard(deck, 2, reverse)
    expect(board[0].id).toBe(3)
  })
})

describe('isMatch', () => {
  const a: Tile = { id: 0, code: 'AS', image: '' }
  const twin: Tile = { id: 1, code: 'AS', image: '' }
  const other: Tile = { id: 2, code: 'KH', image: '' }

  it('matches same code, different id', () => {
    expect(isMatch(a, twin)).toBe(true)
  })

  it('does not match different codes', () => {
    expect(isMatch(a, other)).toBe(false)
  })

  it('does not match a tile with itself', () => {
    expect(isMatch(a, a)).toBe(false)
  })
})

describe('isWin', () => {
  it('is true only when every tile is matched', () => {
    expect(isWin(16, 16)).toBe(true)
    expect(isWin(14, 16)).toBe(false)
    expect(isWin(0, 0)).toBe(false)
  })
})
