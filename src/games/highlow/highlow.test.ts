import { describe, expect, it } from 'vitest'
import { judge } from './highLowLogic'
import { highLowReducer, initHighLow } from './highLowReducer'
import { card } from '../../test/helpers'

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
})
