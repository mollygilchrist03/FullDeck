import { describe, expect, it } from 'vitest'
import {
  formatScore,
  GAME_KEYS,
  isGameKey,
  isValidScore,
  sanitizeName,
  sortDirection,
} from './leaderboard'

const NUL = String.fromCharCode(0)
const DEL = String.fromCharCode(127)
const TAB = String.fromCharCode(9)

describe('isGameKey', () => {
  it('accepts every known key and nothing else', () => {
    for (const k of GAME_KEYS) expect(isGameKey(k)).toBe(true)
    expect(isGameKey('solitaire')).toBe(false)
    expect(isGameKey(null)).toBe(false)
    expect(isGameKey(7)).toBe(false)
  })
})

describe('sanitizeName', () => {
  it('trims and collapses whitespace', () => {
    expect(sanitizeName('   acey   deucey  ')).toBe('acey deucey')
  })
  it('drops non-printable control characters', () => {
    expect(sanitizeName(`a${NUL}bc${DEL}`)).toBe('abc')
  })
  it('treats tab/newline as a space', () => {
    expect(sanitizeName(`a${TAB}b`)).toBe('a b')
  })
  it('caps at 20 characters', () => {
    expect(sanitizeName('x'.repeat(50))).toHaveLength(20)
  })
  it('returns empty string for non-strings', () => {
    expect(sanitizeName(undefined)).toBe('')
    expect(sanitizeName(42)).toBe('')
  })
})

describe('isValidScore', () => {
  it('accepts integers inside the game bounds', () => {
    expect(isValidScore('high-low', 12)).toBe(true)
    expect(isValidScore('blackjack', 5000)).toBe(true)
  })
  it('rejects out-of-range, non-integer, and non-numeric values', () => {
    expect(isValidScore('high-low', 0)).toBe(false) // below min 1
    expect(isValidScore('high-low', 99)).toBe(false) // above max 52
    expect(isValidScore('memory', 12.5)).toBe(false)
    expect(isValidScore('memory', Number.NaN)).toBe(false)
    expect(isValidScore('war', '3' as unknown)).toBe(false)
  })
})

describe('sortDirection', () => {
  it('is desc for higher-is-better games, asc otherwise', () => {
    expect(sortDirection('high-low')).toBe('desc')
    expect(sortDirection('holdem')).toBe('desc')
    expect(sortDirection('memory')).toBe('asc')
    expect(sortDirection('war')).toBe('asc')
  })
})

describe('formatScore', () => {
  it('places the unit correctly', () => {
    expect(formatScore('blackjack', 1250)).toBe('$1,250')
    expect(formatScore('memory', 84)).toBe('84s')
    expect(formatScore('high-low', 15)).toBe('15')
  })
})
