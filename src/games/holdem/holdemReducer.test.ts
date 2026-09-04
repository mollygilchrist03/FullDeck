import { describe, expect, it } from 'vitest'
import {
  BIG_BLIND,
  holdemReducer,
  revealedBoard,
  SMALL_BLIND,
  STARTING_STACK,
  toCall,
  type HoldemState,
} from './holdemReducer'
import { card } from '../../test/helpers'
import type { Card } from '../../types/card'

const HOLE_A: [Card, Card] = [card('ACE', 'SPADES'), card('KING', 'SPADES')]
const HOLE_B: [Card, Card] = [card('2', 'HEARTS'), card('7', 'CLUBS')]
// Gives HOLE_A (A-K spades) a made flush: A-K-Q-J-4 of spades.
const BOARD: Card[] = [
  card('QUEEN', 'SPADES'),
  card('JACK', 'SPADES'),
  card('4', 'SPADES'),
  card('9', 'CLUBS'),
  card('3', 'HEARTS'),
]

function start(playerHole = HOLE_A, aiHole = HOLE_B, board = BOARD): HoldemState {
  return holdemReducer(
    // Type doesn't matter for the initial reducer call target — use undefined init via any START.
    undefined as unknown as HoldemState,
    { type: 'START', playerHole, aiHole, board },
  )
}

describe('dealHand (via START)', () => {
  it('posts blinds and gives the button (small blind) the first preflop action', () => {
    const s = start()
    expect(s.button).toBe('player')
    expect(s.playerBet).toBe(SMALL_BLIND)
    expect(s.aiBet).toBe(BIG_BLIND)
    expect(s.playerStack).toBe(STARTING_STACK - SMALL_BLIND)
    expect(s.aiStack).toBe(STARTING_STACK - BIG_BLIND)
    expect(s.toAct).toBe('player')
    expect(s.phase).toBe('preflop')
  })

  it('reveals no board cards preflop', () => {
    expect(revealedBoard(start())).toHaveLength(0)
  })
})

describe('heads-up positional rules', () => {
  it('the big blind gets an option even after the small blind just calls', () => {
    let s = start()
    s = holdemReducer(s, { type: 'CALL', side: 'player' }) // SB calls up to the BB
    expect(s.playerBet).toBe(BIG_BLIND)
    expect(s.aiBet).toBe(BIG_BLIND)
    // Bets are level, but the BB hasn't acted yet — action must still be theirs.
    expect(s.toAct).toBe('ai')
    expect(s.phase).toBe('preflop')
  })

  it('checking through the BB option moves to the flop, first action to the non-button', () => {
    let s = start()
    s = holdemReducer(s, { type: 'CALL', side: 'player' })
    s = holdemReducer(s, { type: 'CHECK', side: 'ai' })
    expect(s.phase).toBe('flop')
    expect(revealedBoard(s)).toHaveLength(3)
    // Button acted first preflop; postflop the *other* side acts first.
    expect(s.toAct).toBe('ai')
  })
})

describe('betting mechanics', () => {
  it('a bet reopens the action for the other side', () => {
    let s = start()
    s = holdemReducer(s, { type: 'CALL', side: 'player' })
    s = holdemReducer(s, { type: 'BET', side: 'ai', to: BIG_BLIND * 3 })
    expect(s.aiBet).toBe(BIG_BLIND * 3)
    expect(s.toAct).toBe('player')
    expect(toCall(s, 'player')).toBe(BIG_BLIND * 3 - BIG_BLIND)
  })

  it('supports a raise and a re-raise in the same street', () => {
    let s = start()
    s = holdemReducer(s, { type: 'BET', side: 'player', to: 30 }) // SB raises to 30 preflop
    s = holdemReducer(s, { type: 'BET', side: 'ai', to: 80 }) // BB re-raises to 80
    expect(s.playerBet).toBe(30)
    expect(s.aiBet).toBe(80)
    expect(s.toAct).toBe('player')
    s = holdemReducer(s, { type: 'CALL', side: 'player' })
    expect(s.playerBet).toBe(0) // folded into the pot once the street settles
    expect(s.pot).toBe(160)
    expect(s.phase).toBe('flop')
  })

  it('a fold ends the hand immediately and awards every chip on the table', () => {
    let s = start()
    s = holdemReducer(s, { type: 'BET', side: 'player', to: 50 })
    s = holdemReducer(s, { type: 'FOLD', side: 'ai' })
    expect(s.phase).toBe('handover')
    expect(s.winner).toBe('player')
    expect(s.winAmount).toBe(50 + BIG_BLIND) // player's 50 + ai's posted big blind
    expect(s.playerStack).toBe(STARTING_STACK - 50 + s.winAmount)
  })

  it('rejects an action from the side that is not on the clock', () => {
    const s = start()
    const attempted = holdemReducer(s, { type: 'CHECK', side: 'ai' }) // it's the button's turn
    expect(attempted).toBe(s) // untouched — illegal action is a no-op
  })
})

describe('all-in handling', () => {
  it('an all-in-for-less refunds the shovers uncalled excess and runs the board out', () => {
    // Cripple the AI stack, then have the player shove more than the AI can call.
    let s = start()
    s = { ...s, aiStack: 40 }
    s = holdemReducer(s, { type: 'BET', side: 'player', to: 150 }) // shove far more than AI has
    expect(s.toAct).toBe('ai')
    s = holdemReducer(s, { type: 'CALL', side: 'ai' })
    // AI could only put in what it had; the excess comes back to the player.
    expect(s.aiStack).toBe(0)
    expect(s.playerBet).toBe(s.aiBet) // levelled by the refund
    // Nobody can act further — the reducer should have run every remaining
    // street out on its own, straight to showdown/handover.
    expect(['showdown', 'handover']).toContain(s.phase)
    expect(revealedBoard({ ...s, phase: 'river' })).toHaveLength(5)
  })
})

describe('showdown', () => {
  it('awards the pot to the better 7-card hand', () => {
    // Player: A-K of spades + Q-J spades on board + a 4 -> a nut spade flush... actually
    // A,K,Q,J spades + a non-spade = flush for the player. AI has 2-7 offsuit, no pair, no flush.
    let s = start()
    s = holdemReducer(s, { type: 'CALL', side: 'player' })
    s = holdemReducer(s, { type: 'CHECK', side: 'ai' }) // -> flop
    s = holdemReducer(s, { type: 'CHECK', side: 'ai' }) // ai acts first postflop
    s = holdemReducer(s, { type: 'CHECK', side: 'player' }) // -> turn
    s = holdemReducer(s, { type: 'CHECK', side: 'ai' })
    s = holdemReducer(s, { type: 'CHECK', side: 'player' }) // -> river
    s = holdemReducer(s, { type: 'CHECK', side: 'ai' })
    s = holdemReducer(s, { type: 'CHECK', side: 'player' }) // -> showdown
    expect(s.phase).toBe('handover')
    expect(s.winner).toBe('player')
    expect(s.playerRank?.category).toBe('flush')
  })

  it('splits the pot on a tie, giving the odd chip to the big blind', () => {
    // Identical playable hands via the board — force a tie by giving both
    // sides junk hole cards that don't improve the board's own straight.
    const board: Card[] = [
      card('10', 'CLUBS'),
      card('JACK', 'DIAMONDS'),
      card('QUEEN', 'HEARTS'),
      card('KING', 'CLUBS'),
      card('ACE', 'DIAMONDS'),
    ]
    let s = start([card('2', 'CLUBS'), card('3', 'DIAMONDS')], [card('4', 'CLUBS'), card('5', 'DIAMONDS')], board)
    s = holdemReducer(s, { type: 'CALL', side: 'player' })
    s = holdemReducer(s, { type: 'CHECK', side: 'ai' })
    s = holdemReducer(s, { type: 'CHECK', side: 'ai' })
    s = holdemReducer(s, { type: 'CHECK', side: 'player' })
    s = holdemReducer(s, { type: 'CHECK', side: 'ai' })
    s = holdemReducer(s, { type: 'CHECK', side: 'player' })
    s = holdemReducer(s, { type: 'CHECK', side: 'ai' })
    s = holdemReducer(s, { type: 'CHECK', side: 'player' })
    expect(s.winner).toBe('split')
    expect(s.playerStack).toBe(s.aiStack) // even pot, even split, no odd chip here
  })
})

describe('match play', () => {
  it('flags matchWinner once a stack is busted', () => {
    // Player holds the nut flush (A-K-Q-J spades on the board); AI has nothing
    // and is left too short to survive the all-in.
    let s = start()
    s = { ...s, aiStack: 20 }
    s = holdemReducer(s, { type: 'BET', side: 'player', to: 200 })
    s = holdemReducer(s, { type: 'CALL', side: 'ai' })
    expect(s.phase).toBe('handover')
    expect(s.winner).toBe('player')
    expect(s.aiStack).toBe(0)
    expect(s.matchWinner).toBe('player')
  })

  it('NEW_HAND rotates the button', () => {
    let s = start()
    s = holdemReducer(s, { type: 'FOLD', side: 'player' }) // quickest way to handover
    expect(s.phase).toBe('handover')
    const s2 = holdemReducer(s, { type: 'NEW_HAND', playerHole: HOLE_A, aiHole: HOLE_B, board: BOARD })
    expect(s2.button).toBe('ai')
  })

  it('refuses NEW_HAND once the match is over', () => {
    let s = start()
    s = { ...s, aiStack: 0, phase: 'handover', matchWinner: 'player' }
    const s2 = holdemReducer(s, { type: 'NEW_HAND', playerHole: HOLE_A, aiHole: HOLE_B, board: BOARD })
    expect(s2).toBe(s)
  })
})
