import { describe, expect, it } from 'vitest'
import { isCleanName } from './profanity'

describe('isCleanName', () => {
  it('allows ordinary names', () => {
    for (const name of [
      'acey deucey',
      'Molly G',
      'card_shark_88',
      'The Dealer',
      'grandma',
      'bass player',
    ]) {
      expect(isCleanName(name)).toBe(true)
    }
  })

  it('allows the empty string (handled elsewhere)', () => {
    expect(isCleanName('')).toBe(true)
  })

  it('does not flag words that merely contain a bad substring', () => {
    for (const name of ['assassin', 'classic', 'Scunthorpe', 'passage', 'Essex', 'class act']) {
      expect(isCleanName(name)).toBe(true)
    }
  })

  it('rejects obvious profanity', () => {
    for (const name of ['fuck you', 'shithead', 'asshole', 'bitch']) {
      expect(isCleanName(name)).toBe(false)
    }
  })

  it('rejects leetspeak and spacing obfuscation', () => {
    for (const name of ['f u c k', 'sh1t', 'f4ggot', 'b i t c h', 'fuuuck', 'n1gga']) {
      expect(isCleanName(name)).toBe(false)
    }
  })

  it('rejects slurs added in the supplement list', () => {
    for (const name of ['tranny', 'r3tard', 'douchebag']) {
      expect(isCleanName(name)).toBe(false)
    }
  })
})
