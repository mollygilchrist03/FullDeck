/**
 * Server-side game registry for multiplayer rooms. Each entry deals a fresh
 * 52-card array into its reducer's START action, runs the reducer, authorises a
 * seat's action, and reports when the game is over. Imported by the
 * `/api/rooms` serverless function — keep relative imports `.js`-suffixed and
 * free of React.
 */
import type { Card } from '../types/card.js'
import { newDeck, draw } from '../api/deckClient.js'
import type { MpGameKey } from './multiplayer.js'

import { warReducer, initWar } from '../games/war/warReducer.js'
import { slapjackReducer, initSlapjack } from '../games/slapjack/slapjackReducer.js'
import { oldMaidReducer, initOldMaid } from '../games/oldmaid/oldMaidReducer.js'
import { removeOneQueen } from '../games/oldmaid/oldMaidLogic.js'
import {
  crazyEightsReducer,
  initCrazyEights,
  HAND_SIZE as CE_HAND,
} from '../games/crazyeights/crazyEightsReducer.js'
import { goFishReducer, initGoFish } from '../games/gofish/goFishReducer.js'
import { trashReducer, initTrash } from '../games/trash/trashReducer.js'
import { holdemReducer, type HoldemState } from '../games/holdem/holdemReducer.js'

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyState = any
type AnyAction = any

export interface GameServer {
  /** Deal a fresh game from a shuffled deck. `seatCount` is only meaningful
   * to a game whose room can hold more than 2 seats (Hold'em) — every other
   * entry here ignores it. */
  deal: (cards: Card[], seatCount: number) => AnyState
  reduce: (state: AnyState, action: AnyAction) => AnyState
  /** May `seat` (a seat index) send `action` against `state`? */
  authorize: (state: AnyState, seat: number, action: AnyAction) => boolean
  isOver: (state: AnyState) => boolean
  /** Deal the next hand into an in-progress match, carrying state forward
   * (stacks, eliminations, ...) — only Hold'em needs this; every other game
   * here is a single deal per room. */
  dealNextHand?: (state: AnyState, cards: Card[]) => AnyState
}

/** Which reducer role a seat maps to in the player-vs-AI reducers. */
const role = (seat: number): 'player' | 'ai' => (seat === 0 ? 'player' : 'ai')
/** War's roles are named player/dealer rather than player/ai. */
const warRole = (seat: number): 'player' | 'dealer' => (seat === 0 ? 'player' : 'dealer')

const war: GameServer = {
  deal: (c) =>
    warReducer(initWar(), { type: 'START', playerPile: c.slice(0, 26), dealerPile: c.slice(26) }),
  reduce: warReducer,
  authorize: (s, seat, a) =>
    a?.type === 'FLIP' &&
    (s.phase === 'ready' || s.phase === 'war') &&
    a.side === warRole(seat),
  isOver: (s) => s.phase === 'gameover',
}

/** Split `cards` into `n` piles as evenly as possible — the first
 * `cards.length % n` seats get one extra card. At n=2 this is the exact
 * 26/26 split the 2-player game always used. */
function splitPiles(cards: Card[], n: number): Card[][] {
  const base = Math.floor(cards.length / n)
  const extra = cards.length % n
  const piles: Card[][] = []
  let idx = 0
  for (let i = 0; i < n; i += 1) {
    const size = base + (i < extra ? 1 : 0)
    piles.push(cards.slice(idx, idx + size))
    idx += size
  }
  return piles
}

const slapjack: GameServer = {
  deal: (c, seatCount) => slapjackReducer(initSlapjack(seatCount), { type: 'START', piles: splitPiles(c, seatCount) }),
  reduce: slapjackReducer,
  authorize: (s, seat, a) => {
    if (s.phase === 'gameover') return false
    if (a?.type === 'FLIP') return s.phase === 'flipping' && s.turn === seat
    if (a?.type === 'SLAP') return a.who === seat
    return false
  },
  isOver: (s) => s.phase === 'gameover',
}

const oldMaid: GameServer = {
  deal: (raw) => {
    const c = removeOneQueen(raw)
    return oldMaidReducer(initOldMaid(), {
      type: 'START',
      playerHand: c.slice(0, 26),
      aiHand: c.slice(26),
    })
  },
  reduce: oldMaidReducer,
  authorize: (s, seat, a) =>
    a?.type === 'DRAW' && s.phase !== 'gameover' && s.turn === role(seat),
  isOver: (s) => s.phase === 'gameover',
}

const crazyEights: GameServer = {
  deal: (c, seatCount) => {
    const hands: Card[][] = []
    for (let i = 0; i < seatCount; i += 1) hands.push(c.slice(i * CE_HAND, (i + 1) * CE_HAND))
    const rest = c.slice(seatCount * CE_HAND)
    const starterIdx = Math.max(0, rest.findIndex((x) => x.rank !== '8'))
    const discard = [rest[starterIdx]]
    const stock = rest.filter((_, i) => i !== starterIdx)
    return crazyEightsReducer(initCrazyEights(seatCount), {
      type: 'START',
      stock,
      discard,
      hands,
      activeSuit: discard[0].suit,
    })
  },
  reduce: crazyEightsReducer,
  authorize: (s, seat, a) => {
    if (s.phase === 'gameover' || a?.seat !== seat) return false
    if (a?.type === 'CHOOSE_SUIT') return s.phase === 'awaitSuit' && s.wildSeat === seat
    if (a?.type === 'PLAY' || a?.type === 'DRAW' || a?.type === 'PASS') {
      return s.phase === 'turn' && s.turn === seat
    }
    return false
  },
  isOver: (s) => s.phase === 'gameover',
}

const goFish: GameServer = {
  deal: (c) =>
    goFishReducer(initGoFish(), {
      type: 'START',
      playerHand: c.slice(0, 7),
      aiHand: c.slice(7, 14),
      stock: c.slice(14),
    }),
  reduce: goFishReducer,
  authorize: (s, seat, a) => {
    if (s.phase === 'gameover') return false
    const want = role(seat)
    const side = a?.side ?? 'player'
    if (side !== want) return false
    if (a?.type === 'ASK') return s.phase === (want === 'player' ? 'playerAsk' : 'aiAsk')
    if (a?.type === 'DRAW') return s.phase === (want === 'player' ? 'playerDraw' : 'aiDraw')
    return false
  },
  isOver: (s) => s.phase === 'gameover',
}

const trash: GameServer = {
  deal: (c) => {
    const s = trashReducer(initTrash(), {
      type: 'START',
      stock: c.slice(20),
      playerFaceDown: c.slice(0, 10),
      aiFaceDown: c.slice(10, 20),
    })
    return { ...s, soloLadder: false } // online: first cleared row wins
  },
  reduce: trashReducer,
  authorize: (s, seat, a) => {
    if (s.phase === 'gameover') return false
    const want = role(seat)
    const side = a?.side ?? 'player'
    if (side !== want) return false
    if (a?.type === 'PLACE_WILD') return s.phase === 'wildChoice' && s.turn === want
    if (a?.type === 'DRAW' || a?.type === 'TAKE_DISCARD') {
      return s.turn === want && s.phase === (want === 'player' ? 'playerTurn' : 'aiTurn')
    }
    return false
  },
  isOver: (s) => s.phase === 'gameover',
}

const holdem: GameServer = {
  deal: (cards, seatCount) => {
    const holes: Card[][] = []
    for (let i = 0; i < seatCount; i += 1) holes.push([cards[i * 2], cards[i * 2 + 1]])
    const board = cards.slice(seatCount * 2, seatCount * 2 + 5)
    return holdemReducer(undefined as unknown as HoldemState, { type: 'START', seatCount, holes, board })
  },
  reduce: holdemReducer,
  authorize: (s: HoldemState, seat, a) => {
    if (a?.type === 'NEXT_HAND') return s.phase === 'handover' && s.matchWinner == null
    if (s.phase === 'handover' || s.phase === 'showdown') return false
    if (s.toAct !== seat || a?.seat !== seat) return false
    if (a.type === 'BET') return typeof a.to === 'number'
    return a.type === 'CHECK' || a.type === 'CALL' || a.type === 'FOLD'
  },
  isOver: (s: HoldemState) => s.matchWinner != null,
  dealNextHand: (state: HoldemState, cards) => {
    const liveCount = state.seats.filter((st) => !st.eliminated).length
    const holes: Card[][] = []
    for (let i = 0; i < liveCount; i += 1) holes.push([cards[i * 2], cards[i * 2 + 1]])
    const board = cards.slice(liveCount * 2, liveCount * 2 + 5)
    return holdemReducer(state, { type: 'NEW_HAND', holes, board })
  },
}

export const GAME_SERVERS: Partial<Record<MpGameKey, GameServer>> = {
  war,
  slapjack,
  'old-maid': oldMaid,
  'crazy-eights': crazyEights,
  'go-fish': goFish,
  trash,
  holdem,
}

/** Fetch a fresh shuffled 52-card deck (server-side). */
export async function freshDeck(): Promise<Card[]> {
  const { deckId } = await newDeck()
  const { cards } = await draw(deckId, 52)
  return cards
}
