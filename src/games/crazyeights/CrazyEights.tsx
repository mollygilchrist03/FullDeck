import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Layout } from '../../components/Layout.js'
import { Button } from '../../components/Button.js'
import { Card } from '../../components/Card.js'
import { Loading, ErrorNotice } from '../../components/Loading.js'
import { useDeck } from '../../hooks/useDeck.js'
import { ScoreSubmit } from '../../components/ScoreSubmit.js'
import { GameRules } from '../../components/GameRules.js'
import { feedback } from '../../lib/feedback.js'
import { useRecordGameOnce } from '../../hooks/useRecordGame.js'
import type { Rank, Suit } from '../../types/card.js'
import { isPlayable, SUITS } from './crazyEightsLogic.js'
import {
  canDraw,
  crazyEightsReducer,
  HAND_SIZE,
  initCrazyEights,
  seatHasMove,
  topCard,
} from './crazyEightsReducer.js'

const SUIT_GLYPH: Record<Suit, string> = {
  HEARTS: '♥',
  DIAMONDS: '♦',
  CLUBS: '♣',
  SPADES: '♠',
}
const isRed = (s: Suit) => s === 'HEARTS' || s === 'DIAMONDS'
const RANK_ORDER: Record<Rank, number> = {
  ACE: 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8, '10': 9,
  JACK: 10, QUEEN: 11, KING: 12,
}
const AI_STEP_MS = 900
const YOU = 0
const AI = 1

export function CrazyEights() {
  const deck = useDeck()
  const [state, dispatch] = useReducer(crazyEightsReducer, 2, initCrazyEights)
  const [dealing, setDealing] = useState(true)
  const [sortBySuit, setSortBySuit] = useState(false)
  const didInit = useRef(false)

  const { startNewDeck, drawCards } = deck

  const newGame = useCallback(async () => {
    setDealing(true)
    try {
      await startNewDeck()
      const cards = await drawCards(HAND_SIZE * 2 + 4)
      const hands = [cards.slice(0, HAND_SIZE), cards.slice(HAND_SIZE, HAND_SIZE * 2)]
      const rest = cards.slice(HAND_SIZE * 2)
      // The starter can't be an 8 (it would need a suit nomination up front).
      const starterIdx = rest.findIndex((c) => c.rank !== '8')
      const discard = [rest[starterIdx]]
      const stock = rest.filter((_, i) => i !== starterIdx)
      feedback('deal')
      dispatch({
        type: 'START',
        stock,
        discard,
        hands,
        activeSuit: discard[0].suit,
      })
    } catch {
      /* surfaced via deck.error */
    } finally {
      setDealing(false)
    }
  }, [startNewDeck, drawCards])

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    void newGame()
  }, [newGame])

  // Drive the AI's turn one step at a time.
  useEffect(() => {
    if (state.phase !== 'turn' || state.turn !== AI) return
    const t = setTimeout(() => {
      feedback('flip')
      dispatch({ type: 'AI_STEP' })
    }, AI_STEP_MS)
    return () => clearTimeout(t)
  }, [state.phase, state.turn, state.aiSteps])

  useEffect(() => {
    if (state.phase === 'gameover') feedback(state.winner === YOU ? 'win' : 'lose')
  }, [state.phase, state.winner])

  useRecordGameOnce({
    terminal: state.phase === 'gameover',
    game: 'crazy-eights',
    score: state.winner === YOU && !state.stalemate ? state.hands[AI].length : 0,
    detail: state.stalemate
      ? state.winner === YOU
        ? 'Won on a deadlock'
        : 'Lost on a deadlock'
      : state.winner === YOU
        ? `Won — ${state.hands[AI].length} left on the AI`
        : 'Lost',
  })

  const top = state.discard.length ? topCard(state) : null
  const myTurn = state.phase === 'turn' && state.turn === YOU
  const legal = (i: number) =>
    top ? isPlayable(state.hands[YOU][i], top, state.activeSuit) : false
  const hasMove = myTurn && seatHasMove(state, YOU)
  const mustDraw = myTurn && !hasMove && canDraw(state)
  const mustPass = myTurn && !hasMove && !canDraw(state)
  const over = state.phase === 'gameover'

  // Display order only — the reducer plays cards by index, so sorting here
  // never touches game state.
  const handOrder = state.hands[YOU].map((_, i) => i)
  if (sortBySuit) {
    handOrder.sort((a, b) => {
      const ca = state.hands[YOU][a]
      const cb = state.hands[YOU][b]
      if (ca.suit !== cb.suit) return SUITS.indexOf(ca.suit) - SUITS.indexOf(cb.suit)
      return RANK_ORDER[ca.rank] - RANK_ORDER[cb.rank]
    })
  }

  return (
    <Layout
      title="Crazy Eights"
      action={
        <Button variant="gold" onClick={() => void newGame()} disabled={dealing}>
          New game
        </Button>
      }
    >
      {deck.error && (
        <div className="mb-4">
          <ErrorNotice message={deck.error} onRetry={() => void newGame()} />
        </div>
      )}

      <div className="mb-4">
        <GameRules>
          <p>Be first to play every card in your hand (you each start with seven). On your turn, play a card that matches the top of the discard pile by <strong>suit or rank</strong>, or play any <strong>8</strong> (wild) and name the next suit.</p>
          <p>No legal card? Draw from the stock until you get one. If the stock runs out and you still can't play, pass — the stock reshuffles from the discard pile when it empties.</p>
          <p>If both players pass with a dead deck, the game ends and the smaller hand wins.</p>
        </GameRules>
      </div>

      {dealing ? (
        <Loading label="Dealing…" />
      ) : (
        <div className="flex flex-col items-center gap-5">
          {/* AI */}
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs uppercase tracking-widest text-gold/80">
              Opponent — {state.hands[AI].length} card{state.hands[AI].length === 1 ? '' : 's'}
            </p>
            <div className="flex">
              {state.hands[AI].slice(0, 12).map((_, i) => (
                <div key={i} className="-ml-6 first:ml-0 w-10">
                  <Card faceDown />
                </div>
              ))}
            </div>
          </div>

          {/* Table: stock + discard + active suit */}
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => {
                feedback('flip')
                dispatch({ type: 'DRAW' })
              }}
              disabled={!mustDraw}
              className="flex flex-col items-center gap-1 disabled:opacity-60"
              aria-label="Draw a card"
            >
              <div className="w-16">
                <Card faceDown />
              </div>
              <span className="text-xs text-card/70">stock {state.stock.length}</span>
            </button>

            <div className="flex flex-col items-center gap-1">
              <div className="w-20 sm:w-24">{top && <Card card={top} faceDown={false} dealt />}</div>
              <span
                className={`rounded-md px-2 py-0.5 text-sm font-bold ${
                  isRed(state.activeSuit) ? 'text-casino' : 'text-card'
                } bg-black/25`}
              >
                {SUIT_GLYPH[state.activeSuit]} {state.activeSuit[0] + state.activeSuit.slice(1).toLowerCase()}
              </span>
            </div>
          </div>

          {/* Log */}
          <p className="min-h-5 text-center text-sm text-card/75" role="status" aria-live="polite">
            {state.log[state.log.length - 1]}
          </p>

          {/* Suit picker */}
          {state.phase === 'awaitSuit' && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-card/80">Name the suit:</p>
              <div className="flex gap-2">
                {SUITS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      feedback('flip')
                      dispatch({ type: 'CHOOSE_SUIT', suit: s })
                    }}
                    className={`h-12 w-12 rounded-lg border border-gold/50 bg-felt text-2xl ${
                      isRed(s) ? 'text-casino' : 'text-card'
                    } hover:border-gold`}
                    aria-label={s}
                  >
                    {SUIT_GLYPH[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Player hand */}
          <button
            type="button"
            onClick={() => setSortBySuit((v) => !v)}
            className="text-xs text-card/60 underline underline-offset-2 hover:text-card/90"
          >
            {sortBySuit ? 'Unsort hand' : 'Sort by suit'}
          </button>
          <div className="flex flex-wrap justify-center gap-1">
            {handOrder.map((i) => {
              const c = state.hands[YOU][i]
              return (
                <div key={c.code} className="w-14 sm:w-16">
                  <Card
                    card={c}
                    faceDown={false}
                    onClick={
                      myTurn && legal(i)
                        ? () => {
                            feedback('flip')
                            dispatch({ type: 'PLAY', index: i })
                          }
                        : undefined
                    }
                    disabled={!myTurn || !legal(i)}
                    className={myTurn && legal(i) ? 'ring-2 ring-gold' : 'opacity-55'}
                  />
                </div>
              )
            })}
          </div>

          {/* Controls */}
          {myTurn && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    feedback('flip')
                    dispatch({ type: 'DRAW' })
                  }}
                  disabled={!mustDraw}
                >
                  Draw
                </Button>
                <Button
                  variant="accent"
                  onClick={() => {
                    feedback('flip')
                    dispatch({ type: 'PASS' })
                  }}
                  disabled={!mustPass}
                >
                  Pass
                </Button>
              </div>
              <p className="text-xs text-card/60">
                {hasMove
                  ? 'Play one of the highlighted cards.'
                  : mustDraw
                    ? 'No legal card — draw until you can play.'
                    : 'Nothing to play or draw — pass.'}
              </p>
            </div>
          )}

          {over && (
            <div className="flex flex-col items-center gap-3">
              <p className="font-display text-xl text-gold">
                {state.stalemate
                  ? state.winner === YOU
                    ? 'Deadlock — you had fewer cards. You win.'
                    : 'Deadlock — the AI had fewer cards. You lose.'
                  : state.winner === YOU
                    ? 'You went out — you win!'
                    : 'The AI went out. You lose.'}
              </p>
              {!state.stalemate && state.winner === YOU && state.hands[AI].length >= 1 && (
                <ScoreSubmit game="crazy-eights" score={state.hands[AI].length} />
              )}
              <Button size="lg" variant="gold" onClick={() => void newGame()}>
                Play again
              </Button>
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}
