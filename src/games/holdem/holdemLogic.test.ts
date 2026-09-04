import { describe, expect, it } from 'vitest'
import { chooseAiAction, handStrength, preflopStrength } from './holdemLogic'
import { holdemReducer, type HoldemState } from './holdemReducer'
import { card } from '../../test/helpers'
import type { Card } from '../../types/card'

describe('preflopStrength', () => {
  it('ranks pocket aces far above a weak offsuit hand', () => {
    const aces = preflopStrength([card('ACE', 'SPADES'), card('ACE', 'HEARTS')])
    const weak = preflopStrength([card('7', 'CLUBS'), card('2', 'DIAMONDS')])
    expect(aces).toBeGreaterThan(weak)
    expect(aces).toBeGreaterThan(0.7)
    expect(weak).toBeLessThan(0.3)
  })

  it('rewards suited and connected cards over the same ranks offsuit and gapped', () => {
    const suited = preflopStrength([card('9', 'HEARTS'), card('10', 'HEARTS')])
    const offsuit = preflopStrength([card('9', 'CLUBS'), card('10', 'DIAMONDS')])
    expect(suited).toBeGreaterThan(offsuit)
  })
})

describe('handStrength', () => {
  it('falls back to the preflop heuristic before the flop', () => {
    const hole: [Card, Card] = [card('ACE', 'SPADES'), card('ACE', 'HEARTS')]
    expect(handStrength(hole, [])).toBe(preflopStrength(hole))
  })

  it('rates a made flush far above a hand that pairs nothing', () => {
    // Board carries 3 spades so A-K spades completes a flush; 7-8 offsuit
    // shares no rank with the board, so it's genuinely just high card.
    const board = [card('QUEEN', 'SPADES'), card('4', 'SPADES'), card('9', 'SPADES'), card('2', 'CLUBS'), card('3', 'DIAMONDS')]
    const flushHole: [Card, Card] = [card('ACE', 'SPADES'), card('KING', 'SPADES')]
    const nothingHole: [Card, Card] = [card('7', 'DIAMONDS'), card('8', 'CLUBS')]
    expect(handStrength(flushHole, board)).toBeGreaterThan(handStrength(nothingHole, board))
  })
})

function baseState(overrides: Partial<HoldemState>): HoldemState {
  const s = holdemReducer(undefined as unknown as HoldemState, {
    type: 'START',
    playerHole: [card('2', 'CLUBS'), card('3', 'DIAMONDS')],
    aiHole: [card('7', 'CLUBS'), card('2', 'DIAMONDS')],
    board: [card('9', 'HEARTS'), card('10', 'HEARTS'), card('JACK', 'HEARTS'), card('4', 'CLUBS'), card('5', 'SPADES')],
  })
  return { ...s, ...overrides }
}

describe('chooseAiAction', () => {
  it('checks a weak hand when there is nothing to call', () => {
    const s = baseState({ aiHole: [card('7', 'CLUBS'), card('2', 'DIAMONDS')], playerBet: 0, aiBet: 0 })
    expect(chooseAiAction(s)).toEqual({ type: 'CHECK' })
  })

  it('bets a strong made hand when there is nothing to call', () => {
    const s = baseState({
      aiHole: [card('ACE', 'SPADES'), card('KING', 'SPADES')],
      board: [card('QUEEN', 'SPADES'), card('JACK', 'SPADES'), card('4', 'SPADES'), card('9', 'CLUBS'), card('2', 'HEARTS')],
      phase: 'river',
      playerBet: 0,
      aiBet: 0,
      pot: 40,
    })
    const decision = chooseAiAction(s)
    expect(decision.type).toBe('BET')
  })

  it('folds a weak hand facing a large bet', () => {
    const s = baseState({
      aiHole: [card('7', 'CLUBS'), card('2', 'DIAMONDS')],
      board: [card('KING', 'SPADES'), card('QUEEN', 'CLUBS'), card('4', 'DIAMONDS'), card('9', 'HEARTS'), card('3', 'CLUBS')],
      phase: 'river',
      playerBet: 150,
      aiBet: 10,
      aiStack: 190,
      pot: 20,
    })
    expect(chooseAiAction(s)).toEqual({ type: 'FOLD' })
  })

  it('calls a small, cheap bet with a middling hand rather than folding', () => {
    const s = baseState({
      aiHole: [card('9', 'HEARTS'), card('9', 'CLUBS')], // a pair of nines
      board: [card('KING', 'SPADES'), card('4', 'CLUBS'), card('2', 'DIAMONDS'), card('7', 'HEARTS'), card('3', 'SPADES')],
      phase: 'river',
      playerBet: 15,
      aiBet: 10,
      aiStack: 190,
      pot: 40,
    })
    expect(chooseAiAction(s)).toEqual({ type: 'CALL' })
  })
})
