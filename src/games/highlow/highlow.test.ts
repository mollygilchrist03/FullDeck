import { describe, expect, it } from 'vitest'
import { judge, remainingCounts } from './highLowLogic'
import { highLowReducer, initHighLow } from './highLowReducer'
import { card } from '../../test/helpers'

describe('remainingCounts', () => {
  it('splits a fresh deck around the current card (aces high)', () => {
    // Current is a 7 (only card seen). Higher = 8..A = 7 ranks * 4 = 28.
    // Lower = 2..6 = 5 ranks * 4 = 20. Equal = the other three 7s.
    const r = remainingCounts(card('7'), [card('7')])
    expect(r).toEqual({ higher: 28, lower: 20, equal: 3 })
    expect(r.higher + r.lower + r.equal).toBe(51)
  })

  it('subtracts every card already turned over', () => {
    const seen = [card('7'), card('9'), card('9'), card('2'), card('ACE')]
    const r = remainingCounts(card('7'), seen)
    // Higher (8..A): 28 total minus two 9s minus one ace = 25.
    expect(r.higher).toBe(25)
    // Lower (2..6): 20 total minus one 2 = 19.
    expect(r.lower).toBe(19)
    expect(r.equal).toBe(3)
    expect(r.higher + r.lower + r.equal).toBe(52 - seen.length)
  })

  it('an ace has nothing above it', () => {
    expect(remainingCounts(card('ACE'), [card('ACE')]).higher).toBe(0)
  })
})

describe('judge', () => {
  it('rewards a correct higher call', () => {
    expect(judge(card('5'), card('9'), 'higher')).toBe('correct')
  })

  it('rewards a correct lower call', () => {
    expect(judge(card('9'), card('5'), 'lower')).toBe('correct')
  })

  it('punishes a wrong call', () => {
    expect(judge(card('9'), card('5'), 'higher')).toBe('wrong')
    expect(judge(card('5'), card('9'), 'lower')).toBe('wrong')
  })

  it('calls equal ranks a push', () => {
    expect(judge(card('7', 'HEARTS'), card('7', 'CLUBS'), 'higher')).toBe('push')
    expect(judge(card('7', 'HEARTS'), card('7', 'CLUBS'), 'lower')).toBe('push')
  })

  it('treats the ace as the high card', () => {
    expect(judge(card('KING'), card('ACE'), 'higher')).toBe('correct')
    expect(judge(card('ACE'), card('2'), 'lower')).toBe('correct')
  })
})

describe('highLowReducer', () => {
  const started = () => highLowReducer(initHighLow(), { type: 'START', first: card('8') })

  it('starts a run on the first card', () => {
    const s = started()
    expect(s.phase).toBe('guessing')
    expect(s.current?.rank).toBe('8')
    expect(s.seen).toBe(1)
    expect(s.seenCards.map((c) => c.rank)).toEqual(['8'])
  })

  it('records every card turned over for the counter', () => {
    let s = highLowReducer(started(), { type: 'GUESS', guess: 'higher', next: card('KING') })
    s = highLowReducer(s, { type: 'CONTINUE' })
    s = highLowReducer(s, { type: 'GUESS', guess: 'lower', next: card('4') })
    expect(s.seenCards.map((c) => c.rank)).toEqual(['8', 'KING', '4'])
  })

  it('extends the streak on a correct guess and waits to continue', () => {
    const s = highLowReducer(started(), { type: 'GUESS', guess: 'higher', next: card('KING') })
    expect(s.lastJudgement).toBe('correct')
    expect(s.streak).toBe(1)
    expect(s.phase).toBe('revealed')
  })

  it('ends the run on a wrong guess without extending the streak', () => {
    const s = highLowReducer(started(), { type: 'GUESS', guess: 'higher', next: card('3') })
    expect(s.lastJudgement).toBe('wrong')
    expect(s.streak).toBe(0)
    expect(s.phase).toBe('gameover')
  })

  it('survives a push with the streak untouched', () => {
    let s = highLowReducer(started(), { type: 'GUESS', guess: 'higher', next: card('KING') })
    s = highLowReducer(s, { type: 'CONTINUE' })
    s = highLowReducer(s, { type: 'GUESS', guess: 'lower', next: card('KING') })
    expect(s.lastJudgement).toBe('push')
    expect(s.streak).toBe(1)
    expect(s.phase).toBe('revealed')
  })

  it('advances to the revealed card on CONTINUE', () => {
    let s = highLowReducer(started(), { type: 'GUESS', guess: 'higher', next: card('KING') })
    s = highLowReducer(s, { type: 'CONTINUE' })
    expect(s.current?.rank).toBe('KING')
    expect(s.revealed).toBeNull()
    expect(s.phase).toBe('guessing')
  })

  it('ignores a guess once the run is over', () => {
    const dead = highLowReducer(started(), { type: 'GUESS', guess: 'higher', next: card('3') })
    expect(highLowReducer(dead, { type: 'GUESS', guess: 'lower', next: card('2') })).toBe(dead)
  })

  it('clearing all 52 cards is a win', () => {
    // seen starts at 1; the 51st guess brings seen to 52.
    const s = highLowReducer({ ...started(), seen: 51, streak: 50, current: card('2') }, {
      type: 'GUESS',
      guess: 'higher',
      next: card('KING'),
    })
    expect(s.phase).toBe('won')
    expect(s.streak).toBe(51)
  })
})
