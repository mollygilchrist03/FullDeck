/**
 * Heads-up No-Limit Texas Hold'em — a real betting engine, not a simplified
 * "bet the same amount every time" toy. Runs on bet-TO semantics (an action
 * names the total you'll have put in this street, not an increment), which
 * is what makes multi-raise streets and all-in-for-less trivial to express.
 *
 * Big simplifying trick: all 5 board cards are dealt into state up front
 * (same call as Go Fish/Trash keeping the whole stock in state) and only
 * *revealed* a few at a time by phase — so running out an all-in to
 * showdown is just advancing phase with no further card draws needed, and
 * the reducer never has to ask the container for cards mid-hand.
 */
import type { Card } from '../../types/card'
import { bestHand, compareHandRank, type HandRank } from './handRank'

export type HoldemPhase = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'handover'
export type Side = 'player' | 'ai'

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

export interface HoldemState {
  phase: HoldemPhase
  button: Side
  /** Whose action it is; null once nobody needs to act (showdown/handover). */
  toAct: Side | null
  playerStack: number
  aiStack: number
  playerHole: Card[]
  aiHole: Card[]
  /** All 5, always — see BOARD_SHOWN for how many `revealedBoard` shows. */
  board: Card[]
  /** Chips already folded in from completed streets. */
  pot: number
  playerBet: number
  aiBet: number
  actedPlayer: boolean
  actedAi: boolean
  playerFolded: boolean
  aiFolded: boolean
  winner: Side | 'split' | null
  winAmount: number
  playerRank: HandRank | null
  aiRank: HandRank | null
  log: string[]
  handsPlayed: number
  /** Set once a stack hits 0 after a hand settles — the match is over. */
  matchWinner: Side | null
}

export type HoldemAction =
  | { type: 'START'; playerHole: [Card, Card]; aiHole: [Card, Card]; board: Card[] }
  | { type: 'NEW_HAND'; playerHole: [Card, Card]; aiHole: [Card, Card]; board: Card[] }
  | { type: 'CHECK'; side: Side }
  | { type: 'CALL'; side: Side }
  | { type: 'BET'; side: Side; to: number }
  | { type: 'FOLD'; side: Side }

const other = (side: Side): Side => (side === 'player' ? 'ai' : 'player')
const push = (log: string[], line: string): string[] => [...log, line].slice(-6)

function stackOf(s: HoldemState, side: Side): number {
  return side === 'player' ? s.playerStack : s.aiStack
}
function betOf(s: HoldemState, side: Side): number {
  return side === 'player' ? s.playerBet : s.aiBet
}
function setStack(s: HoldemState, side: Side, value: number): HoldemState {
  return side === 'player' ? { ...s, playerStack: value } : { ...s, aiStack: value }
}
function setBet(s: HoldemState, side: Side, value: number): HoldemState {
  return side === 'player' ? { ...s, playerBet: value } : { ...s, aiBet: value }
}
function setActed(s: HoldemState, side: Side, value: boolean): HoldemState {
  return side === 'player' ? { ...s, actedPlayer: value } : { ...s, actedAi: value }
}

export function toCall(s: HoldemState, side: Side): number {
  return Math.max(0, betOf(s, other(side)) - betOf(s, side))
}

/** The most a side could bet/raise TO this street (an all-in). */
export function maxBetTo(s: HoldemState, side: Side): number {
  return betOf(s, side) + stackOf(s, side)
}

export function revealedBoard(s: HoldemState): Card[] {
  return s.board.slice(0, BOARD_SHOWN[s.phase])
}

export function initHoldem(): HoldemState {
  return {
    phase: 'preflop',
    button: 'player',
    toAct: null,
    playerStack: STARTING_STACK,
    aiStack: STARTING_STACK,
    playerHole: [],
    aiHole: [],
    board: [],
    pot: 0,
    playerBet: 0,
    aiBet: 0,
    actedPlayer: false,
    actedAi: false,
    playerFolded: false,
    aiFolded: false,
    winner: null,
    winAmount: 0,
    playerRank: null,
    aiRank: null,
    log: [],
    handsPlayed: 0,
    matchWinner: null,
  }
}

/** Posts blinds for a fresh hand, dealing hole/board cards and setting up
 * preflop action (button/small-blind acts first, heads-up). */
function dealHand(
  s: HoldemState,
  button: Side,
  playerHole: [Card, Card],
  aiHole: [Card, Card],
  board: Card[],
): HoldemState {
  const sbSide = button
  const bbSide = other(button)
  let next: HoldemState = {
    ...s,
    phase: 'preflop',
    button,
    playerHole,
    aiHole,
    board,
    pot: 0,
    playerBet: 0,
    aiBet: 0,
    actedPlayer: false,
    actedAi: false,
    playerFolded: false,
    aiFolded: false,
    winner: null,
    winAmount: 0,
    playerRank: null,
    aiRank: null,
    handsPlayed: s.handsPlayed + 1,
  }
  const sb = Math.min(SMALL_BLIND, stackOf(next, sbSide))
  next = setBet(setStack(next, sbSide, stackOf(next, sbSide) - sb), sbSide, sb)
  const bb = Math.min(BIG_BLIND, stackOf(next, bbSide))
  next = setBet(setStack(next, bbSide, stackOf(next, bbSide) - bb), bbSide, bb)
  next = {
    ...next,
    log: push(next.log, `New hand — ${sbSide === 'player' ? 'you have' : 'the house has'} the button.`),
  }
  return settleIfNeeded(next, sbSide)
}

/** True once nobody can or needs to act further on the current street. */
function bettingDone(s: HoldemState): boolean {
  if (s.playerStack === 0 || s.aiStack === 0) return s.playerBet === s.aiBet
  return s.actedPlayer && s.actedAi && s.playerBet === s.aiBet
}

/** Folds this street's bets into the pot and either opens the next street's
 * action or (river done / all-in runout) proceeds to showdown. Recurses when
 * a stack is already at 0, so an all-in runs straight out to showdown with
 * no further betting. */
function advanceStreet(s: HoldemState): HoldemState {
  const potNow = s.pot + s.playerBet + s.aiBet
  const base: HoldemState = {
    ...s,
    pot: potNow,
    playerBet: 0,
    aiBet: 0,
    actedPlayer: s.playerStack === 0,
    actedAi: s.aiStack === 0,
  }

  if (s.phase === 'river') return showdown(base)

  const nextPhase: HoldemPhase = s.phase === 'preflop' ? 'flop' : s.phase === 'flop' ? 'turn' : 'river'
  const firstToAct = other(s.button)
  const dealt: HoldemState = {
    ...base,
    phase: nextPhase,
    toAct: firstToAct,
    log: push(base.log, `${nextPhase[0].toUpperCase()}${nextPhase.slice(1)}.`),
  }
  return settleIfNeeded(dealt, firstToAct)
}

/** Call after any action that might have finished the street. `nextToAct` is
 * who should act if betting *isn't* resolved yet — the caller knows this
 * (the other side of whoever just acted, or the street's first-to-act). */
function settleIfNeeded(s: HoldemState, nextToAct: Side): HoldemState {
  if (s.playerFolded || s.aiFolded) return s
  if (bettingDone(s)) return advanceStreet(s)
  return { ...s, toAct: nextToAct }
}

function withMatchCheck(s: HoldemState): HoldemState {
  if (s.playerStack === 0) return { ...s, matchWinner: 'ai' }
  if (s.aiStack === 0) return { ...s, matchWinner: 'player' }
  return s
}

function awardPot(s: HoldemState, winner: Side | 'split'): HoldemState {
  const total = s.pot + s.playerBet + s.aiBet
  let next: HoldemState = { ...s, pot: 0, playerBet: 0, aiBet: 0, phase: 'handover', toAct: null, winner }
  if (winner === 'split') {
    const half = Math.floor(total / 2)
    next = setStack(next, 'player', next.playerStack + half)
    // Odd chip (only possible with an odd total) goes to the big blind.
    next = setStack(next, 'ai', next.aiStack + (total - half))
    next = { ...next, winAmount: half }
  } else {
    next = setStack(next, winner, stackOf(next, winner) + total)
    next = { ...next, winAmount: total }
  }
  return withMatchCheck(next)
}

function showdown(s: HoldemState): HoldemState {
  const playerRank = bestHand([...s.playerHole, ...s.board])
  const aiRank = bestHand([...s.aiHole, ...s.board])
  const cmp = compareHandRank(playerRank, aiRank)
  const winner: Side | 'split' = cmp > 0 ? 'player' : cmp < 0 ? 'ai' : 'split'
  const awarded = awardPot({ ...s, phase: 'showdown', playerRank, aiRank }, winner)
  const msg =
    winner === 'split'
      ? `Split pot — both had ${playerRank.category}.`
      : winner === 'player'
        ? `You win ${awarded.winAmount} with ${playerRank.category}.`
        : `The house wins ${awarded.winAmount} with ${aiRank.category}.`
  return { ...awarded, log: push(s.log, msg) }
}

function fold(s: HoldemState, side: Side): HoldemState {
  const winner = other(side)
  const marked = side === 'player' ? { ...s, playerFolded: true } : { ...s, aiFolded: true }
  const awarded = awardPot(marked, winner)
  return {
    ...awarded,
    log: push(s.log, `${side === 'player' ? 'You' : 'The house'} fold${side === 'player' ? '' : 's'}.`),
  }
}

function check(s: HoldemState, side: Side): HoldemState {
  if (toCall(s, side) !== 0) return s
  const acted = setActed(s, side, true)
  return settleIfNeeded(
    {
      ...acted,
      log: push(acted.log, `${side === 'player' ? 'You' : 'The house'} check${side === 'player' ? '' : 's'}.`),
    },
    other(side),
  )
}

function call(s: HoldemState, side: Side): HoldemState {
  const need = toCall(s, side)
  if (need === 0) return check(s, side)
  const opp = other(side)
  const paid = Math.min(need, stackOf(s, side))
  let next = setStack(s, side, stackOf(s, side) - paid)
  next = setBet(next, side, betOf(next, side) + paid)
  next = setActed(next, side, true)
  // All-in for less: refund the shover's uncalled excess.
  const shortfall = need - paid
  if (shortfall > 0) {
    next = setBet(next, opp, betOf(next, opp) - shortfall)
    next = setStack(next, opp, stackOf(next, opp) + shortfall)
  }
  return settleIfNeeded(
    {
      ...next,
      log: push(next.log, `${side === 'player' ? 'You' : 'The house'} call${side === 'player' ? '' : 's'}.`),
    },
    other(side),
  )
}

function bet(s: HoldemState, side: Side, to: number): HoldemState {
  const cap = maxBetTo(s, side)
  const opp = other(side)
  // Can't even call, let alone raise — that's an all-in-for-less CALL, not a BET.
  if (cap <= betOf(s, opp)) return s
  const clamped = Math.max(betOf(s, opp) + 1, Math.min(to, cap))
  if (clamped <= betOf(s, side)) return s // not a real raise
  const delta = clamped - betOf(s, side)
  let next = setStack(s, side, stackOf(s, side) - delta)
  next = setBet(next, side, clamped)
  next = setActed(next, side, true)
  next = setActed(next, opp, false) // a new bet reopens the action
  const isRaise = betOf(s, opp) > 0
  const word = side === 'player' ? (isRaise ? 'raise to' : 'bet') : isRaise ? 'raises to' : 'bets'
  return {
    ...next,
    toAct: opp,
    log: push(next.log, `${side === 'player' ? 'You' : 'The house'} ${word} ${clamped}.`),
  }
}

export function holdemReducer(state: HoldemState, action: HoldemAction): HoldemState {
  switch (action.type) {
    case 'START':
      return dealHand(initHoldem(), 'player', action.playerHole, action.aiHole, action.board)

    case 'NEW_HAND': {
      if (state.phase !== 'handover' || state.matchWinner) return state
      return dealHand(state, other(state.button), action.playerHole, action.aiHole, action.board)
    }

    case 'CHECK':
      if (state.phase === 'handover' || state.phase === 'showdown' || state.toAct !== action.side) return state
      return check(state, action.side)

    case 'CALL':
      if (state.phase === 'handover' || state.phase === 'showdown' || state.toAct !== action.side) return state
      return call(state, action.side)

    case 'BET':
      if (state.phase === 'handover' || state.phase === 'showdown' || state.toAct !== action.side) return state
      if (stackOf(state, action.side) === 0) return state
      return bet(state, action.side, action.to)

    case 'FOLD':
      if (state.phase === 'handover' || state.phase === 'showdown' || state.toAct !== action.side) return state
      return fold(state, action.side)

    default:
      return state
  }
}
