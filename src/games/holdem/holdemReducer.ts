/**
 * No-Limit Texas Hold'em for 2-6 seats — a real betting engine with side
 * pots, not a simplified "everyone bets the same" toy. Runs on bet-TO
 * semantics (an action names the total you'll have put in this street, not
 * an increment), which is what makes multi-raise streets and all-in-for-less
 * trivial to express.
 *
 * Seats are addressed by index (0..seats.length-1), not named roles — the
 * same reducer runs a 2-seat solo-vs-AI match and a 6-seat online table.
 * `contributed` (each seat's running total for the whole hand, never reset
 * between streets) is the only bookkeeping side pots need: nothing is
 * "refunded" mid-street when a short all-in can't be fully called — an
 * uncalled excess just becomes a pot layer only its contributor reaches,
 * which resolves to a plain refund at showdown. See `computeSidePots`.
 *
 * Big simplifying trick, same as the old heads-up version: all of a hand's
 * hole cards + the 5 board cards are dealt into state up front and only
 * *revealed* a few at a time by phase — so running an all-in out to
 * showdown is just advancing phase, no further card draws needed.
 */
import type { Card } from '../../types/card.js'
import { bestHand, compareHandRank, CATEGORY_LABEL, type HandCategory } from './handRank.js'

export type HoldemPhase = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'handover'

export const SMALL_BLIND = 5
export const BIG_BLIND = 10
export const STARTING_STACK = 200
const BOARD_SHOWN: Record<HoldemPhase, number> = {
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
  showdown: 5,
  handover: 5,
}

export interface SeatState {
  stack: number
  hole: Card[]
  /** Chips in this street. */
  bet: number
  /** Chips in this *hand*, across every street — the only number side pots need. */
  contributed: number
  folded: boolean
  acted: boolean
  /** Stack hit 0 after a hand settled — sits out every hand for the rest of the match. */
  eliminated: boolean
}

export interface PotResult {
  amount: number
  winners: number[]
  category?: HandCategory
}

export interface HoldemState {
  phase: HoldemPhase
  seats: SeatState[]
  /** Seat index holding the button. */
  button: number
  /** Whose action it is; null once nobody needs to act. */
  toAct: number | null
  /** All 5, always — see BOARD_SHOWN for how many `revealedBoard` shows. */
  board: Card[]
  /** Size of the last full bet/raise this street — the minimum a re-raise must
   * add on top of the current bet (a short all-in is the only exception). */
  lastRaise: number
  /** How the last hand's pot(s) were split — empty until a hand ends. */
  potResults: PotResult[]
  log: string[]
  handsPlayed: number
  /** Seat index once only one seat still has chips — the match is over. */
  matchWinner: number | null
}

export type HoldemAction =
  | { type: 'START'; seatCount: number; holes: Card[][]; board: Card[] }
  | { type: 'NEW_HAND'; holes: Card[][]; board: Card[] }
  | { type: 'CHECK'; seat: number }
  | { type: 'CALL'; seat: number }
  | { type: 'BET'; seat: number; to: number }
  | { type: 'FOLD'; seat: number }

const push = (log: string[], line: string): string[] => [...log, line].slice(-6)

/** Highest bet still standing among seats that haven't folded. */
function highBet(s: HoldemState): number {
  return Math.max(0, ...s.seats.filter((st) => !st.folded).map((st) => st.bet))
}

export function toCall(s: HoldemState, seat: number): number {
  return Math.max(0, highBet(s) - s.seats[seat].bet)
}

/** The most a seat could bet/raise TO this street (an all-in). */
export function maxBetTo(s: HoldemState, seat: number): number {
  return s.seats[seat].bet + s.seats[seat].stack
}

/** Total chips in the pot right now, current street included. */
export function potTotal(s: HoldemState): number {
  return s.seats.reduce((sum, st) => sum + st.contributed, 0)
}

export function revealedBoard(s: HoldemState): Card[] {
  return s.board.slice(0, BOARD_SHOWN[s.phase])
}

/** Idle table state before the first hand is dealt. */
export function initHoldem(seatCount: number): HoldemState {
  return {
    phase: 'handover',
    seats: Array.from({ length: seatCount }, () => ({
      stack: STARTING_STACK,
      hole: [],
      bet: 0,
      contributed: 0,
      folded: false,
      acted: false,
      eliminated: false,
    })),
    button: 0,
    toAct: null,
    board: [],
    lastRaise: BIG_BLIND,
    potResults: [],
    log: [],
    handsPlayed: 0,
    matchWinner: null,
  }
}

/** Next seat (clockwise) that hasn't busted — used for the button and blinds,
 * which land on a live seat even mid-hand-setup, before anyone's folded. */
function nextLiveSeat(seats: SeatState[], from: number): number {
  const n = seats.length
  for (let step = 1; step <= n; step += 1) {
    const i = (from + step) % n
    if (!seats[i].eliminated) return i
  }
  return from
}

/** Next seat that still needs to act this street: not folded, not eliminated,
 * not already all-in. Assumed to exist whenever this is called. */
function nextToActFrom(s: HoldemState, fromSeat: number): number {
  const n = s.seats.length
  for (let step = 1; step <= n; step += 1) {
    const i = (fromSeat + step) % n
    const st = s.seats[i]
    if (!st.folded && !st.eliminated && st.stack > 0) return i
  }
  return fromSeat
}

function postBlind(seats: SeatState[], seat: number, amount: number): SeatState[] {
  const paid = Math.min(amount, seats[seat].stack)
  return seats.map((st, i) =>
    i === seat ? { ...st, stack: st.stack - paid, bet: st.bet + paid, contributed: st.contributed + paid } : st,
  )
}

/** Deals hole cards, posts blinds, and opens preflop action. `holes` has one
 * entry per non-eliminated seat, in seat-index order. Heads-up, the button
 * posts the small blind and acts first preflop (last on every street after);
 * 3+, blinds are the two seats after the button and action opens under the gun —
 * both fall out of always resuming action from the big blind's seat. */
function beginHand(baseSeats: SeatState[], button: number, holes: Card[][], board: Card[], handsPlayed: number): HoldemState {
  let holeIdx = 0
  let seats = baseSeats.map((st) =>
    st.eliminated
      ? { ...st, hole: [], bet: 0, contributed: 0, folded: true, acted: true }
      : { ...st, hole: holes[holeIdx++], bet: 0, contributed: 0, folded: false, acted: false },
  )
  const liveCount = seats.filter((st) => !st.eliminated).length
  const sbSeat = liveCount === 2 ? button : nextLiveSeat(seats, button)
  const bbSeat = nextLiveSeat(seats, sbSeat)
  seats = postBlind(seats, sbSeat, SMALL_BLIND)
  seats = postBlind(seats, bbSeat, BIG_BLIND)

  const base: HoldemState = {
    phase: 'preflop',
    seats,
    button,
    toAct: null,
    board,
    lastRaise: BIG_BLIND,
    potResults: [],
    log: push([], 'New hand.'),
    handsPlayed: handsPlayed + 1,
    matchWinner: null,
  }
  return settleIfNeeded(base, bbSeat)
}

function startHand(seatCount: number, holes: Card[][], board: Card[]): HoldemState {
  const seats: SeatState[] = Array.from({ length: seatCount }, () => ({
    stack: STARTING_STACK,
    hole: [],
    bet: 0,
    contributed: 0,
    folded: false,
    acted: false,
    eliminated: false,
  }))
  return beginHand(seats, 0, holes, board, 0)
}

function nextHand(state: HoldemState, holes: Card[][], board: Card[]): HoldemState {
  const button = nextLiveSeat(state.seats, state.button)
  return beginHand(state.seats, button, holes, board, state.handsPlayed)
}

/** True once every seat still in the hand has matched the high bet or is all-in. */
function bettingDone(s: HoldemState): boolean {
  const actors = s.seats.filter((st) => !st.folded && !st.eliminated && st.stack > 0)
  const hb = highBet(s)
  // Fewer than 2 seats that could still act means there's nobody left who
  // could raise further — so a lone actor only needs to have *matched* the
  // high bet (e.g. called a short all-in), not necessarily to have "acted"
  // on a fresh street with nothing yet to call. With 2+ still-live actors,
  // every one of them has to have both acted and matched.
  if (actors.length <= 1) return actors.every((st) => st.bet === hb)
  return actors.every((st) => st.acted && st.bet === hb)
}

/** Call after any action that might have finished the street. `fromSeat` is
 * who just acted (or the street's dealer-adjacent seat, at street start) —
 * either way the next actor is simply the next live seat after them. */
function settleIfNeeded(s: HoldemState, fromSeat: number): HoldemState {
  if (bettingDone(s)) return advanceStreet(s)
  return { ...s, toAct: nextToActFrom(s, fromSeat) }
}

const STREET_LABEL: Record<string, string> = { flop: 'Flop', turn: 'Turn', river: 'River' }

/** Folds this street's bets in (bets already live in `contributed`, so this
 * is just clearing `bet` for the next street) and opens the next street's
 * action, or — river done, or every remaining seat is all-in — goes to
 * showdown. Recurses when nobody's left who can act, so an all-in runs
 * straight out to showdown with no further betting. */
function advanceStreet(s: HoldemState): HoldemState {
  if (s.phase === 'river') return showdownAward(s)
  const nextPhase: HoldemPhase = s.phase === 'preflop' ? 'flop' : s.phase === 'flop' ? 'turn' : 'river'
  const seats = s.seats.map((st) => ({ ...st, bet: 0, acted: st.stack === 0 }))
  const dealt: HoldemState = {
    ...s,
    phase: nextPhase,
    seats,
    lastRaise: BIG_BLIND,
    toAct: null,
    log: push(s.log, `${STREET_LABEL[nextPhase]}.`),
  }
  return settleIfNeeded(dealt, s.button)
}

/** Layer the pot by each seat's total contribution this hand — the classic
 * side-pot algorithm. A seat whose all-in fell short of the table only
 * contests pot layers up to its own contribution; a fold contributes chips
 * to every layer it reached but is never eligible to win one. Adjacent
 * layers with the same eligible set are merged, purely so the "N pots"
 * shown to a player matches how a table would actually describe them. */
function computeSidePots(seats: SeatState[]): { amount: number; eligible: number[] }[] {
  const levels = [...new Set(seats.map((st) => st.contributed).filter((c) => c > 0))].sort((a, b) => a - b)
  const pots: { amount: number; eligible: number[] }[] = []
  let prev = 0
  for (const level of levels) {
    const contributors = seats.map((st, i) => (st.contributed >= level ? i : -1)).filter((i) => i >= 0)
    const amount = (level - prev) * contributors.length
    if (amount > 0) {
      const eligible = contributors.filter((i) => !seats[i].folded)
      const last = pots[pots.length - 1]
      if (last && last.eligible.length === eligible.length && last.eligible.every((x) => eligible.includes(x))) {
        last.amount += amount
      } else {
        pots.push({ amount, eligible })
      }
    }
    prev = level
  }
  return pots
}

/** Split order for an odd chip in a tied pot: the eligible winner closest to
 * the button, going clockwise (the same seat that would act first postflop). */
function orderByButton(winners: number[], button: number, seatCount: number): number[] {
  return [...winners].sort((a, b) => ((a - button + seatCount) % seatCount) - ((b - button + seatCount) % seatCount))
}

function describeResults(results: PotResult[]): string {
  return results
    .map((r, i) => {
      const prefix = results.length > 1 ? `Pot ${i + 1}: ` : ''
      const who = r.winners.length > 1 ? `Seats ${r.winners.map((w) => w + 1).join('/')} split` : `Seat ${r.winners[0] + 1} wins`
      const hand = r.category ? ` with ${CATEGORY_LABEL[r.category]}` : ''
      return `${prefix}${who} $${r.amount}${hand}.`
    })
    .join(' ')
}

/** Award each pot layer's chips, mark any seat that hit 0 as eliminated, and
 * check whether only one seat is left standing (match over). */
function finishHand(s: HoldemState, results: PotResult[]): HoldemState {
  let seats = s.seats.map((st) => ({ ...st }))
  for (const pr of results) {
    const share = Math.floor(pr.amount / pr.winners.length)
    let remainder = pr.amount - share * pr.winners.length
    for (const w of orderByButton(pr.winners, s.button, s.seats.length)) {
      const extra = remainder > 0 ? 1 : 0
      remainder = Math.max(0, remainder - 1)
      seats[w] = { ...seats[w], stack: seats[w].stack + share + extra }
    }
  }
  seats = seats.map((st) => (st.stack === 0 && !st.eliminated ? { ...st, eliminated: true } : st))
  const stillIn = seats.reduce<number[]>((acc, st, i) => (st.eliminated ? acc : [...acc, i]), [])
  return {
    ...s,
    seats,
    phase: 'handover',
    toAct: null,
    potResults: results,
    matchWinner: stillIn.length === 1 ? stillIn[0] : null,
    log: push(s.log, describeResults(results)),
  }
}

/** Every seat but one folded — that seat scoops the whole pot, no showdown. */
function foldWin(s: HoldemState, winnerSeat: number): HoldemState {
  return finishHand(s, [{ amount: potTotal(s), winners: [winnerSeat] }])
}

function showdownAward(s: HoldemState): HoldemState {
  const pots = computeSidePots(s.seats)
  const results: PotResult[] = pots.map((pot) => {
    if (pot.eligible.length === 1) return { amount: pot.amount, winners: pot.eligible }
    const ranked = pot.eligible.map((i) => ({ i, rank: bestHand([...s.seats[i].hole, ...s.board]) }))
    const best = ranked.reduce((b, r) => (compareHandRank(r.rank, b.rank) > 0 ? r : b))
    const winners = ranked.filter((r) => compareHandRank(r.rank, best.rank) === 0).map((r) => r.i)
    return { amount: pot.amount, winners, category: best.rank.category }
  })
  return finishHand({ ...s, phase: 'showdown' }, results)
}

function fold(s: HoldemState, seat: number): HoldemState {
  const seats = s.seats.map((st, i) => (i === seat ? { ...st, folded: true, acted: true } : st))
  const withLog = { ...s, seats, log: push(s.log, `Seat ${seat + 1} folds.`) }
  const remaining = seats.reduce<number[]>((acc, st, i) => (st.folded ? acc : [...acc, i]), [])
  if (remaining.length === 1) return foldWin(withLog, remaining[0])
  return settleIfNeeded(withLog, seat)
}

function check(s: HoldemState, seat: number): HoldemState {
  if (toCall(s, seat) !== 0) return s
  const seats = s.seats.map((st, i) => (i === seat ? { ...st, acted: true } : st))
  const next = { ...s, seats, log: push(s.log, `Seat ${seat + 1} checks.`) }
  return settleIfNeeded(next, seat)
}

function call(s: HoldemState, seat: number): HoldemState {
  const need = toCall(s, seat)
  if (need === 0) return check(s, seat)
  const st0 = s.seats[seat]
  const paid = Math.min(need, st0.stack)
  const seats = s.seats.map((st, i) =>
    i === seat ? { ...st, stack: st.stack - paid, bet: st.bet + paid, contributed: st.contributed + paid, acted: true } : st,
  )
  const next = { ...s, seats, log: push(s.log, `Seat ${seat + 1} calls.`) }
  return settleIfNeeded(next, seat)
}

function bet(s: HoldemState, seat: number, to: number): HoldemState {
  const cap = maxBetTo(s, seat) // this seat's all-in total
  const hb = highBet(s)
  // Can't even call, let alone raise — that's an all-in-for-less CALL, not a BET.
  if (cap <= hb) return s
  if (to <= hb) return s // not attempting to raise at all — use CALL

  // No-limit min-raise: a raise must add at least the size of the previous
  // bet/raise on top of the current bet (`lastRaise`); the min *bet* on an
  // unbet street is one big blind. A requested amount below that is bumped up
  // — except a shove that is itself short, which is allowed all-in. (A short
  // all-in *should* deny players who already called a full bet the right to
  // re-raise it — this project keeps that edge case simple, like the min-raise
  // rule before it: any raise, short or full, reopens the action for everyone.)
  const minRaiseTo = hb + s.lastRaise
  const target = Math.min(cap, Math.max(to, minRaiseTo))

  const st0 = s.seats[seat]
  if (target <= st0.bet) return s
  const delta = target - st0.bet
  let seats = s.seats.map((st, i) =>
    i === seat ? { ...st, stack: st.stack - delta, bet: target, contributed: st.contributed + delta, acted: true } : st,
  )
  seats = seats.map((st, i) => (i !== seat && !st.folded && !st.eliminated && st.stack > 0 ? { ...st, acted: false } : st))
  const increment = target - hb
  const lastRaise = increment >= s.lastRaise ? increment : s.lastRaise
  const word = hb > 0 ? 'raises to' : 'bets'
  const next = { ...s, seats, lastRaise, log: push(s.log, `Seat ${seat + 1} ${word} ${target}.`) }
  return settleIfNeeded(next, seat)
}

function canAct(s: HoldemState, seat: number): boolean {
  return s.phase !== 'handover' && s.phase !== 'showdown' && s.toAct === seat
}

export function holdemReducer(state: HoldemState, action: HoldemAction): HoldemState {
  switch (action.type) {
    case 'START':
      return startHand(action.seatCount, action.holes, action.board)

    case 'NEW_HAND':
      if (state.phase !== 'handover' || state.matchWinner != null) return state
      return nextHand(state, action.holes, action.board)

    case 'CHECK':
      if (!canAct(state, action.seat)) return state
      return check(state, action.seat)

    case 'CALL':
      if (!canAct(state, action.seat)) return state
      return call(state, action.seat)

    case 'BET':
      if (!canAct(state, action.seat)) return state
      if (state.seats[action.seat].stack === 0) return state
      return bet(state, action.seat, action.to)

    case 'FOLD':
      if (!canAct(state, action.seat)) return state
      return fold(state, action.seat)

    default:
      return state
  }
}
