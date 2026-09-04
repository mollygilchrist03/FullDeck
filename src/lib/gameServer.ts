/**
 * Server-side game registry for multiplayer rooms. Each entry deals a fresh
 * 52-card array into its reducer's START action, runs the reducer, authorises a
 * seat's action, and reports when the game is over. Imported by the
 * `/api/rooms` serverless function — keep relative imports `.js`-suffixed and
 * free of React.
 */
import type { Card } from '../types/card'
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

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyState = any
type AnyAction = any

export interface GameServer {
  deal: (cards: Card[]) => AnyState
  reduce: (state: AnyState, action: AnyAction) => AnyState
  /** May `seat` (0 or 1) send `action` against `state`? */
  authorize: (state: AnyState, seat: number, action: AnyAction) => boolean
  isOver: (state: AnyState) => boolean
}

/** Which reducer role a seat maps to in the player-vs-AI reducers. */
const role = (seat: number): 'player' | 'ai' => (seat === 0 ? 'player' : 'ai')

const war: GameServer = {
  deal: (c) =>
    warReducer(initWar(), { type: 'START', playerPile: c.slice(0, 26), dealerPile: c.slice(26) }),
  reduce: warReducer,
  authorize: (s, _seat, a) =>
    a?.type === 'FLIP' && (s.phase === 'ready' || s.phase === 'war'),
  isOver: (s) => s.phase === 'gameover',
}

const slapjack: GameServer = {
  deal: (c) =>
    slapjackReducer(initSlapjack(), { type: 'START', playerPile: c.slice(0, 26), aiPile: c.slice(26) }),
  reduce: slapjackReducer,
  authorize: (s, seat, a) => {
    if (s.phase === 'gameover') return false
    if (a?.type === 'FLIP') return s.phase === 'flipping' && (s.turn === role(seat))
    if (a?.type === 'SLAP') return a.who === role(seat)
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
  deal: (c) => {
    const playerHand = c.slice(0, CE_HAND)
    const aiHand = c.slice(CE_HAND, CE_HAND * 2)
    const rest = c.slice(CE_HAND * 2)
    const starterIdx = Math.max(0, rest.findIndex((x) => x.rank !== '8'))
    const discard = [rest[starterIdx]]
    const stock = rest.filter((_, i) => i !== starterIdx)
    return crazyEightsReducer(initCrazyEights(), {
      type: 'START',
      stock,
      discard,
      playerHand,
      aiHand,
      activeSuit: discard[0].suit,
    })
  },
  reduce: crazyEightsReducer,
  authorize: (s, seat, a) => {
    if (s.phase === 'gameover') return false
    const want = role(seat)
    const side = a?.side ?? 'player'
    if (side !== want) return false
    if (a?.type === 'CHOOSE_SUIT') return s.phase === 'awaitSuit' && s.wildSide === want
    if (a?.type === 'PLAY' || a?.type === 'DRAW' || a?.type === 'PASS') {
      return s.phase === (want === 'player' ? 'playerTurn' : 'aiTurn')
    }
    return false
  },
  isOver: (s) => s.phase === 'gameover',
}

export const GAME_SERVERS: Partial<Record<MpGameKey, GameServer>> = {
  war,
  slapjack,
  'old-maid': oldMaid,
  'crazy-eights': crazyEights,
}

/** Fetch a fresh shuffled 52-card deck (server-side). */
export async function freshDeck(): Promise<Card[]> {
  const { deckId } = await newDeck()
  const { cards } = await draw(deckId, 52)
  return cards
}
