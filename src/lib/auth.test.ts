import { describe, expect, it } from 'vitest'
import { isValidEmail, normalizeEmail, passwordProblem, PASSWORD_MIN } from './auth'

describe('isValidEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('first.last+tag@sub.example.com')).toBe(true)
  })

  it('rejects malformed or non-string input', () => {
    expect(isValidEmail('not-an-email')).toBe(false)
    expect(isValidEmail('missing@domain')).toBe(false)
    expect(isValidEmail('spaces in@x.com')).toBe(false)
    expect(isValidEmail('@x.com')).toBe(false)
    expect(isValidEmail(42)).toBe(false)
    expect(isValidEmail('a@b.co'.padEnd(300, 'x'))).toBe(false) // over 254 chars
  })
})

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com')
  })
})

describe('passwordProblem', () => {
  it('is null for an acceptable password', () => {
    expect(passwordProblem('a'.repeat(PASSWORD_MIN))).toBeNull()
  })

  it('flags too-short, too-long, and non-string passwords', () => {
    expect(passwordProblem('short')).toMatch(/at least/)
    expect(passwordProblem('x'.repeat(200))).toMatch(/too long/)
    expect(passwordProblem(undefined)).toMatch(/Enter a password/)
  })
})
