import { describe, expect, it } from 'vitest'
import { chooseAiAction, handStrength, preflopStrength } from './holdemLogic'
import { holdemReducer, type HoldemPhase, type HoldemState } from './holdemReducer'
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

const YOU_HOLE: [Card, Card] = [card('2', 'CLUBS'), card('3', 'DIAMONDS')]
const DEFAULT_AI_HOLE: [Card, Card] = [card('7', 'CLUBS'), card('2', 'DIAMONDS')]
const DEFAULT_BOARD: Card[] = [
  card('9', 'HEARTS'),
  card('10', 'HEARTS'),
  card('JACK', 'HEARTS'),
  card('4', 'CLUBS'),
  card('5', 'SPADES'),
]

/** A 2-seat state (seat 0 = you, seat 1 = the AI) with the AI's hole/board/
 * bets/stack/pot set directly, for testing `chooseAiAction(s, 1)` in isolation. */
function aiState(overrides: {
  aiHole?: [Card, Card]
  board?: Card[]
  phase?: HoldemPhase
  playerBet?: number
  aiBet?: number
  aiStack?: number
  pot?: number
}): HoldemState {
  const s = holdemReducer(undefined as unknown as HoldemState, {
    type: 'START',
    seatCount: 2,
    holes: [YOU_HOLE, overrides.aiHole ?? DEFAULT_AI_HOLE],
    board: overrides.board ?? DEFAULT_BOARD,
  })
  const playerBet = overrides.playerBet ?? 0
  const aiBet = overrides.aiBet ?? 0
  // `pot` here means chips already in from earlier streets — potTotal (this
  // helper's only channel to chooseAiAction's pot-odds math) must come out to
  // exactly pot + playerBet + aiBet, same as the old state.pot + bets formula.
  const priorPot = overrides.pot ?? 0
  return {
    ...s,
    phase: overrides.phase ?? s.phase,
    seats: [
      { ...s.seats[0], bet: playerBet, contributed: playerBet + priorPot },
      { ...s.seats[1], bet: aiBet, contributed: aiBet, stack: overrides.aiStack ?? s.seats[1].stack },
    ],
  }
}

describe('chooseAiAction', () => {
  it('checks a weak hand when there is nothing to call', () => {
    const s = aiState({ aiHole: [card('7', 'CLUBS'), card('2', 'DIAMONDS')], playerBet: 0, aiBet: 0 })
    expect(chooseAiAction(s, 1)).toEqual({ type: 'CHECK' })
  })

  it('bets a strong made hand when there is nothing to call', () => {
    const s = aiState({
      aiHole: [card('ACE', 'SPADES'), card('KING', 'SPADES')],
      board: [card('QUEEN', 'SPADES'), card('JACK', 'SPADES'), card('4', 'SPADES'), card('9', 'CLUBS'), card('2', 'HEARTS')],
      phase: 'river',
      playerBet: 0,
      aiBet: 0,
      pot: 40,
    })
    const decision = chooseAiAction(s, 1)
    expect(decision.type).toBe('BET')
  })

  it('folds a weak hand facing a large bet', () => {
    const s = aiState({
      aiHole: [card('7', 'CLUBS'), card('2', 'DIAMONDS')],
      board: [card('KING', 'SPADES'), card('QUEEN', 'CLUBS'), card('4', 'DIAMONDS'), card('9', 'HEARTS'), card('3', 'CLUBS')],
      phase: 'river',
      playerBet: 150,
      aiBet: 10,
      aiStack: 190,
      pot: 20,
    })
    expect(chooseAiAction(s, 1)).toEqual({ type: 'FOLD' })
  })

  it('calls a small, cheap bet with a middling hand rather than folding', () => {
    const s = aiState({
      aiHole: [card('9', 'HEARTS'), card('9', 'CLUBS')], // a pair of nines
      board: [card('KING', 'SPADES'), card('4', 'CLUBS'), card('2', 'DIAMONDS'), card('7', 'HEARTS'), card('3', 'SPADES')],
      phase: 'river',
      playerBet: 15,
      aiBet: 10,
      aiStack: 190,
      pot: 40,
    })
    expect(chooseAiAction(s, 1)).toEqual({ type: 'CALL' })
  })

  it('value-bets top pair when checked to (not a pure nit)', () => {
    const s = aiState({
      aiHole: [card('ACE', 'HEARTS'), card('KING', 'CLUBS')], // top pair of aces
      board: [card('ACE', 'SPADES'), card('7', 'CLUBS'), card('2', 'DIAMONDS'), card('4', 'HEARTS'), card('9', 'SPADES')],
      phase: 'river',
      playerBet: 0,
      aiBet: 0,
      pot: 30,
    })
    expect(chooseAiAction(s, 1).type).toBe('BET')
  })

  it('calls a half-pot bet with top pair instead of folding it', () => {
    const s = aiState({
      aiHole: [card('ACE', 'HEARTS'), card('KING', 'CLUBS')],
      board: [card('ACE', 'SPADES'), card('7', 'CLUBS'), card('2', 'DIAMONDS'), card('4', 'HEARTS'), card('9', 'SPADES')],
      phase: 'river',
      playerBet: 20, // half of the 40 pot
      aiBet: 0,
      aiStack: 200,
      pot: 40,
    })
    expect(chooseAiAction(s, 1)).toEqual({ type: 'CALL' })
  })

  it('raises a set facing a bet', () => {
    const s = aiState({
      aiHole: [card('9', 'HEARTS'), card('9', 'CLUBS')],
      board: [card('9', 'SPADES'), card('KING', 'CLUBS'), card('4', 'DIAMONDS'), card('2', 'HEARTS'), card('7', 'SPADES')],
      phase: 'river',
      playerBet: 20,
      aiBet: 0,
      aiStack: 200,
      pot: 40,
    })
    expect(chooseAiAction(s, 1).type).toBe('BET') // a raise
  })

  it('tightens up facing more live opponents with the same marginal hand', () => {
    // A spot right on the fold/call boundary heads-up should fold outright
    // with two more live opponents still behind, since equity drops as more
    // players see the same board.
    const board = [card('KING', 'SPADES'), card('QUEEN', 'CLUBS'), card('4', 'DIAMONDS'), card('9', 'HEARTS'), card('3', 'CLUBS')]
    const headsUp = aiState({
      aiHole: [card('4', 'HEARTS'), card('5', 'CLUBS')],
      board,
      phase: 'river',
      playerBet: 60,
      aiBet: 10,
      aiStack: 100,
      pot: 20,
    })
    const multiway: HoldemState = {
      ...headsUp,
      seats: [
        ...headsUp.seats,
        { stack: 90, hole: [card('6', 'DIAMONDS'), card('6', 'SPADES')], bet: 0, contributed: 0, folded: false, acted: false, eliminated: false },
        { stack: 90, hole: [card('8', 'HEARTS'), card('8', 'SPADES')], bet: 0, contributed: 0, folded: false, acted: false, eliminated: false },
      ],
    }
    expect(chooseAiAction(multiway, 1).type).toBe('FOLD')
  })
})
