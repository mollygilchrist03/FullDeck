import { describe, expect, it } from 'vitest'
import {
  BIG_BLIND,
  holdemReducer,
  initHoldem,
  maxBetTo,
  potTotal,
  revealedBoard,
  SMALL_BLIND,
  STARTING_STACK,
  toCall,
  type HoldemState,
} from './holdemReducer'
import { chooseAiAction } from './holdemLogic'
import { card, shuffledDeck } from '../../test/helpers'
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

/** Seat 0 = button. Two seats unless `holes` says otherwise. */
function start(holes: Card[][] = [HOLE_A, HOLE_B], board = BOARD): HoldemState {
  return holdemReducer(undefined as unknown as HoldemState, { type: 'START', seatCount: holes.length, holes, board })
}

describe('dealHand (via START)', () => {
  it('posts blinds and gives the button (small blind) the first preflop action, heads-up', () => {
    const s = start()
    expect(s.button).toBe(0)
    expect(s.seats[0].bet).toBe(SMALL_BLIND)
    expect(s.seats[1].bet).toBe(BIG_BLIND)
    expect(s.seats[0].stack).toBe(STARTING_STACK - SMALL_BLIND)
    expect(s.seats[1].stack).toBe(STARTING_STACK - BIG_BLIND)
    expect(s.toAct).toBe(0)
    expect(s.phase).toBe('preflop')
  })

  it('reveals no board cards preflop', () => {
    expect(revealedBoard(start())).toHaveLength(0)
  })

  it('3+ players: blinds are the two seats after the button, action opens under the gun', () => {
    const s = start([HOLE_A, HOLE_B, [card('9', 'DIAMONDS'), card('9', 'HEARTS')]])
    expect(s.button).toBe(0)
    expect(s.seats[0].bet).toBe(0)
    expect(s.seats[1].bet).toBe(SMALL_BLIND)
    expect(s.seats[2].bet).toBe(BIG_BLIND)
    expect(s.toAct).toBe(0) // wraps back to the button, the only seat left to act (UTG)
  })
})

describe('heads-up positional rules', () => {
  it('the big blind gets an option even after the small blind just calls', () => {
    let s = start()
    s = holdemReducer(s, { type: 'CALL', seat: 0 }) // SB calls up to the BB
    expect(s.seats[0].bet).toBe(BIG_BLIND)
    expect(s.seats[1].bet).toBe(BIG_BLIND)
    // Bets are level, but the BB hasn't acted yet — action must still be theirs.
    expect(s.toAct).toBe(1)
    expect(s.phase).toBe('preflop')
  })

  it('checking through the BB option moves to the flop, first action to the non-button', () => {
    let s = start()
    s = holdemReducer(s, { type: 'CALL', seat: 0 })
    s = holdemReducer(s, { type: 'CHECK', seat: 1 })
    expect(s.phase).toBe('flop')
    expect(revealedBoard(s)).toHaveLength(3)
    // Button acted first preflop; postflop the *other* seat acts first.
    expect(s.toAct).toBe(1)
  })
})

describe('betting mechanics', () => {
  it('a bet reopens the action for the other side', () => {
    let s = start()
    s = holdemReducer(s, { type: 'CALL', seat: 0 })
    s = holdemReducer(s, { type: 'BET', seat: 1, to: BIG_BLIND * 3 })
    expect(s.seats[1].bet).toBe(BIG_BLIND * 3)
    expect(s.toAct).toBe(0)
    expect(toCall(s, 0)).toBe(BIG_BLIND * 3 - BIG_BLIND)
  })

  it('supports a raise and a re-raise in the same street', () => {
    let s = start()
    s = holdemReducer(s, { type: 'BET', seat: 0, to: 30 }) // SB raises to 30 preflop
    s = holdemReducer(s, { type: 'BET', seat: 1, to: 80 }) // BB re-raises to 80
    expect(s.seats[0].bet).toBe(30)
    expect(s.seats[1].bet).toBe(80)
    expect(s.toAct).toBe(0)
    s = holdemReducer(s, { type: 'CALL', seat: 0 })
    expect(s.seats[0].bet).toBe(0) // cleared for the new street; still counted in `contributed`
    expect(potTotal(s)).toBe(160)
    expect(s.phase).toBe('flop')
  })

  it('a fold ends the hand immediately and awards every chip on the table', () => {
    let s = start()
    s = holdemReducer(s, { type: 'BET', seat: 0, to: 50 })
    s = holdemReducer(s, { type: 'FOLD', seat: 1 })
    expect(s.phase).toBe('handover')
    expect(s.potResults).toEqual([{ amount: 50 + BIG_BLIND, winners: [0] }])
    expect(s.seats[0].stack).toBe(STARTING_STACK - 50 + 50 + BIG_BLIND)
  })

  it('rejects an action from the seat that is not on the clock', () => {
    const s = start()
    const attempted = holdemReducer(s, { type: 'CHECK', seat: 1 }) // it's the button's turn
    expect(attempted).toBe(s) // untouched — illegal action is a no-op
  })

  it('enforces the no-limit min-raise (a short raise is bumped up)', () => {
    // Preflop: BB is 10, so the smallest legal raise is to 20.
    let s = start()
    s = holdemReducer(s, { type: 'BET', seat: 0, to: 12 }) // asks for a too-small raise
    expect(s.seats[0].bet).toBe(20) // bumped to the minimum
    expect(s.lastRaise).toBe(10)

    // Seat 0 raised to 20 (increment 10). A re-raise must add at least 10 more.
    s = holdemReducer(s, { type: 'BET', seat: 1, to: 25 }) // still short
    expect(s.seats[1].bet).toBe(30) // 20 + the 10 min increment
    expect(s.lastRaise).toBe(10)

    // Now the last raise increment is bigger — make it 60 total (increment 30).
    s = holdemReducer(s, { type: 'BET', seat: 0, to: 60 })
    expect(s.seats[0].bet).toBe(60)
    expect(s.lastRaise).toBe(30)
    // Min re-raise is now 60 + 30 = 90.
    s = holdemReducer(s, { type: 'BET', seat: 1, to: 61 })
    expect(s.seats[1].bet).toBe(90)
  })

  it('allows a short all-in that raises by less than a full increment', () => {
    // House can cover the bet but not a full min-raise on top.
    let s = start()
    s = holdemReducer(s, { type: 'BET', seat: 0, to: 20 }) // SB min-raises to 20
    s = { ...s, seats: s.seats.map((st, i) => (i === 1 ? { ...st, stack: 12 } : st)) } // bet 10 + 12 stack -> can go to 22 total
    s = holdemReducer(s, { type: 'BET', seat: 1, to: 999 }) // shove
    expect(s.seats[1].stack).toBe(0)
    expect(s.seats[1].bet).toBe(22) // a legal short all-in raise (increment 7 < the min 10)
    expect(s.lastRaise).toBe(10) // a short all-in doesn't raise the bar
  })
})

describe('all-in handling', () => {
  it('an all-in-for-less runs the board out and refunds the shover’s uncalled excess at showdown', () => {
    // Cripple seat 1's stack, then have seat 0 shove more than seat 1 can call.
    let s = start()
    s = { ...s, seats: s.seats.map((st, i) => (i === 1 ? { ...st, stack: 40 } : st)) }
    s = holdemReducer(s, { type: 'BET', seat: 0, to: 150 }) // shove far more than seat 1 has
    expect(s.toAct).toBe(1)
    s = holdemReducer(s, { type: 'CALL', seat: 1 })
    // Seat 1 could only put in what it had — nobody can act further, so the
    // reducer runs every remaining street out on its own, straight to showdown.
    expect(s.seats[1].stack).toBe(0)
    expect(['showdown', 'handover']).toContain(s.phase)
    // The uncalled 100 above seat 1's all-in comes back to seat 0 as its own
    // one-eligible-seat pot layer, however the contested layer plays out.
    const uncalledLayer = s.potResults.find((r) => r.winners.length === 1 && r.winners[0] === 0 && r.amount === 100)
    expect(uncalledLayer).toBeDefined()
  })
})

describe('showdown', () => {
  it('awards the pot to the better 7-card hand', () => {
    // Seat 0: A-K of spades + Q-J spades on board + a 4 -> a nut spade flush.
    // Seat 1 has 2-7 offsuit, no pair, no flush.
    let s = start()
    s = holdemReducer(s, { type: 'CALL', seat: 0 })
    s = holdemReducer(s, { type: 'CHECK', seat: 1 }) // -> flop
    s = holdemReducer(s, { type: 'CHECK', seat: 1 }) // seat 1 acts first postflop
    s = holdemReducer(s, { type: 'CHECK', seat: 0 }) // -> turn
    s = holdemReducer(s, { type: 'CHECK', seat: 1 })
    s = holdemReducer(s, { type: 'CHECK', seat: 0 }) // -> river
    s = holdemReducer(s, { type: 'CHECK', seat: 1 })
    s = holdemReducer(s, { type: 'CHECK', seat: 0 }) // -> showdown
    expect(s.phase).toBe('handover')
    expect(s.potResults[0].winners).toEqual([0])
    expect(s.potResults[0].category).toBe('flush')
  })

  it('splits the pot on a tie, giving the odd chip to the seat closest to the button', () => {
    // Identical playable hands via the board — force a tie by giving both
    // seats junk hole cards that don't improve the board's own straight.
    const board: Card[] = [
      card('10', 'CLUBS'),
      card('JACK', 'DIAMONDS'),
      card('QUEEN', 'HEARTS'),
      card('KING', 'CLUBS'),
      card('ACE', 'DIAMONDS'),
    ]
    let s = start([[card('2', 'CLUBS'), card('3', 'DIAMONDS')], [card('4', 'CLUBS'), card('5', 'DIAMONDS')]], board)
    s = holdemReducer(s, { type: 'CALL', seat: 0 })
    s = holdemReducer(s, { type: 'CHECK', seat: 1 })
    s = holdemReducer(s, { type: 'CHECK', seat: 1 })
    s = holdemReducer(s, { type: 'CHECK', seat: 0 })
    s = holdemReducer(s, { type: 'CHECK', seat: 1 })
    s = holdemReducer(s, { type: 'CHECK', seat: 0 })
    s = holdemReducer(s, { type: 'CHECK', seat: 1 })
    s = holdemReducer(s, { type: 'CHECK', seat: 0 })
    expect(s.potResults[0].winners.sort()).toEqual([0, 1])
    expect(s.seats[0].stack).toBe(s.seats[1].stack) // even pot, even split, no odd chip here
  })

  it('three-way: a side pot forms when one seat is all-in for less than the others', () => {
    // Seat 2 (a set of nines) can only put in 20 total; seats 0 and 1 (junk
    // hands that miss the board entirely) keep betting past that.
    const board: Card[] = [
      card('KING', 'CLUBS'),
      card('QUEEN', 'DIAMONDS'),
      card('2', 'HEARTS'),
      card('5', 'SPADES'),
      card('8', 'CLUBS'),
    ]
    const holes: Card[][] = [
      [card('3', 'CLUBS'), card('4', 'DIAMONDS')],
      [card('6', 'HEARTS'), card('7', 'SPADES')],
      [card('9', 'DIAMONDS'), card('9', 'HEARTS')],
    ]
    let s = start(holes, board)
    // 3-way: seat 0 is button/UTG, seat 1 is SB, seat 2 is BB (posted before
    // this override drops seat 2's remaining stack to a short 10).
    expect(s.seats[1].bet).toBe(SMALL_BLIND)
    expect(s.seats[2].bet).toBe(BIG_BLIND)
    s = { ...s, seats: s.seats.map((st, i) => (i === 2 ? { ...st, stack: 10 } : st)) }
    s = holdemReducer(s, { type: 'BET', seat: 0, to: 60 }) // button raises big
    s = holdemReducer(s, { type: 'CALL', seat: 1 })
    s = holdemReducer(s, { type: 'CALL', seat: 2 }) // only has 10 left -> all-in for 20 total
    expect(s.seats[2].stack).toBe(0)
    expect(s.seats[2].eliminated).toBe(false) // busted this hand, but only once it's awarded
    // Action is done: seats 0/1 matched at 60, seat 2 is all-in — run the rest
    // of the board out with the two remaining actors checking every street.
    while (s.phase !== 'handover') {
      s = holdemReducer(s, { type: 'CHECK', seat: s.toAct as number })
    }
    expect(s.phase).toBe('handover')
    // Two pot layers: a 3-way main pot capped at seat 2's 20, and a heads-up
    // side pot between seats 0 and 1 for the rest.
    expect(s.potResults.length).toBe(2)
    const total = s.potResults.reduce((sum, r) => sum + r.amount, 0)
    expect(total).toBe(20 * 3 + (60 - 20) * 2)
    expect(s.potResults[0].amount).toBe(60) // main pot: 20 from each of 3 seats
    const sidePot = s.potResults[1]
    expect(sidePot.amount).toBe(80) // side pot: the extra 40 each from seats 0/1
    expect(sidePot.winners).not.toContain(2) // seat 2 never contributed to this layer
  })
})

describe('match play', () => {
  it('flags matchWinner once a stack is busted', () => {
    // Seat 0 holds the nut flush (A-K-Q-J spades on the board); seat 1 has
    // nothing and is left too short to survive the all-in.
    let s = start()
    s = { ...s, seats: s.seats.map((st, i) => (i === 1 ? { ...st, stack: 20 } : st)) }
    s = holdemReducer(s, { type: 'BET', seat: 0, to: 200 })
    s = holdemReducer(s, { type: 'CALL', seat: 1 })
    expect(s.phase).toBe('handover')
    expect(s.potResults[0].winners).toEqual([0])
    expect(s.seats[1].stack).toBe(0)
    expect(s.seats[1].eliminated).toBe(true)
    expect(s.matchWinner).toBe(0)
  })

  it('NEW_HAND rotates the button', () => {
    let s = start()
    s = holdemReducer(s, { type: 'FOLD', seat: 0 }) // quickest way to handover
    expect(s.phase).toBe('handover')
    const s2 = holdemReducer(s, { type: 'NEW_HAND', holes: [HOLE_A, HOLE_B], board: BOARD })
    expect(s2.button).toBe(1)
  })

  it('refuses NEW_HAND once the match is over', () => {
    let s = start()
    s = { ...s, seats: s.seats.map((st, i) => (i === 1 ? { ...st, stack: 0, eliminated: true } : st)), phase: 'handover', matchWinner: 0 }
    const s2 = holdemReducer(s, { type: 'NEW_HAND', holes: [HOLE_A, HOLE_B], board: BOARD })
    expect(s2).toBe(s)
  })
})

describe('holdem full-match fuzz', () => {
  it('every heads-up match reaches a winner with chips conserved — no stuck betting (100 matches)', () => {
    const dealArgs = (n: number) => {
      const d = shuffledDeck()
      const holes: Card[][] = []
      for (let i = 0; i < n; i += 1) holes.push([d[i * 2], d[i * 2 + 1]])
      return { holes, board: d.slice(n * 2, n * 2 + 5) }
    }
    for (let match = 0; match < 100; match += 1) {
      let s = holdemReducer(undefined as unknown as HoldemState, { type: 'START', seatCount: 2, ...dealArgs(2) })
      let steps = 0
      while (s.matchWinner == null && steps < 6000) {
        steps += 1
        if (s.phase === 'handover') {
          s = holdemReducer(s, { type: 'NEW_HAND', ...dealArgs(2) })
          continue
        }
        const seat = s.toAct as number
        if (seat === 1) {
          const d = chooseAiAction(s, 1)
          s = d.type === 'BET' ? holdemReducer(s, { type: 'BET', seat: 1, to: d.to }) : holdemReducer(s, { type: d.type, seat: 1 })
          continue
        }
        // Seat 0: mostly check/call, sometimes fold, sometimes shove.
        const call = toCall(s, 0)
        const r = Math.random()
        if (r < 0.08) s = holdemReducer(s, { type: 'FOLD', seat: 0 })
        else if (r < 0.16 && s.seats[0].stack > 0) s = holdemReducer(s, { type: 'BET', seat: 0, to: maxBetTo(s, 0) })
        else s = holdemReducer(s, { type: call === 0 ? 'CHECK' : 'CALL', seat: 0 })
      }
      expect(s.matchWinner).not.toBeNull()
      const total = s.seats.reduce((sum, st) => sum + st.stack, 0)
      expect(total).toBe(STARTING_STACK * 2)
    }
  })

  it('every 4-handed match reaches a winner with chips conserved — no stuck betting (60 matches)', () => {
    const dealArgs = (n: number) => {
      const d = shuffledDeck()
      const holes: Card[][] = []
      for (let i = 0; i < n; i += 1) holes.push([d[i * 2], d[i * 2 + 1]])
      return { holes, board: d.slice(n * 2, n * 2 + 5) }
    }
    for (let match = 0; match < 60; match += 1) {
      let s = holdemReducer(undefined as unknown as HoldemState, { type: 'START', seatCount: 4, ...dealArgs(4) })
      let steps = 0
      while (s.matchWinner == null && steps < 8000) {
        steps += 1
        if (s.phase === 'handover') {
          const liveHoles = s.seats.filter((st) => !st.eliminated).length
          s = holdemReducer(s, { type: 'NEW_HAND', ...dealArgs(liveHoles) })
          continue
        }
        const seat = s.toAct as number
        const d = chooseAiAction(s, seat)
        s = d.type === 'BET' ? holdemReducer(s, { type: 'BET', seat, to: d.to }) : holdemReducer(s, { type: d.type, seat })
      }
      expect(s.matchWinner).not.toBeNull()
      const total = s.seats.reduce((sum, st) => sum + st.stack, 0)
      expect(total).toBe(STARTING_STACK * 4)
    }
  })
})

describe('initHoldem', () => {
  it('builds an idle table of the requested size', () => {
    const s = initHoldem(4)
    expect(s.seats).toHaveLength(4)
    expect(s.seats.every((st) => st.stack === STARTING_STACK)).toBe(true)
    expect(s.matchWinner).toBeNull()
  })
})
