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
import { SEAT_RANGE } from '../../lib/multiplayer.js'
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
const MIN_SEATS = 2
const MAX_SEATS = SEAT_RANGE['crazy-eights'].max

export function CrazyEights() {
  const deck = useDeck()
  const [seatCount, setSeatCount] = useState(2)
  const [started, setStarted] = useState(false)
  const [state, dispatch] = useReducer(crazyEightsReducer, 2, initCrazyEights)
  const [dealing, setDealing] = useState(false)
  const [sortBySuit, setSortBySuit] = useState(false)
  const didInit = useRef(false)

  const { startNewDeck, drawCards } = deck

  const newGame = useCallback(
    async (seats: number) => {
      setDealing(true)
      try {
        await startNewDeck()
        const cards = await drawCards(HAND_SIZE * seats + 4)
        const hands = Array.from({ length: seats }, (_, i) =>
          cards.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE),
        )
        const rest = cards.slice(HAND_SIZE * seats)
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
    },
    [startNewDeck, drawCards],
  )

  useEffect(() => {
    if (!started || didInit.current) return
    didInit.current = true
    void newGame(seatCount)
  }, [started, newGame, seatCount])

  // Drive whichever AI seat's turn it is (every seat but yours, in solo play).
  useEffect(() => {
    if (state.phase !== 'turn' || state.turn === YOU) return
    const t = setTimeout(() => {
      feedback('flip')
      dispatch({ type: 'AI_STEP' })
    }, AI_STEP_MS)
    return () => clearTimeout(t)
  }, [state.phase, state.turn, state.aiSteps])

  useEffect(() => {
    if (state.phase === 'gameover') feedback(state.winner === YOU ? 'win' : 'lose')
  }, [state.phase, state.winner])

  const opponents = state.hands.map((_, i) => i).filter((i) => i !== YOU)
  const opponentCardsLeft = opponents.reduce((sum, i) => sum + state.hands[i].length, 0)

  useRecordGameOnce({
    terminal: state.phase === 'gameover',
    game: 'crazy-eights',
    score: state.winner === YOU && !state.stalemate ? opponentCardsLeft : 0,
    detail: state.stalemate
      ? state.winner === YOU
        ? 'Won on a deadlock'
        : 'Lost on a deadlock'
      : state.winner === YOU
        ? `Won — ${opponentCardsLeft} left on the table`
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

  if (!started) {
    return (
      <Layout title="Crazy Eights">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-4 text-center">
          <p className="text-card/80">Playing solo? Pick how many AI opponents to face.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: MAX_SEATS - MIN_SEATS + 1 }, (_, i) => MIN_SEATS + i).map((n) => (
              <Button
                key={n}
                variant={n === seatCount ? 'gold' : 'ghost'}
                onClick={() => setSeatCount(n)}
              >
                {n - 1} AI{n - 1 === 1 ? '' : 's'}
              </Button>
            ))}
          </div>
          <Button size="lg" variant="gold" onClick={() => setStarted(true)}>
            Deal
          </Button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout
      title="Crazy Eights"
      action={
        <Button variant="gold" onClick={() => void newGame(seatCount)} disabled={dealing}>
          New game
        </Button>
      }
    >
      {deck.error && (
        <div className="mb-4">
          <ErrorNotice message={deck.error} onRetry={() => void newGame(seatCount)} />
        </div>
      )}

      <div className="mb-4">
        <GameRules>
          <p>Be first to play every card in your hand (everyone starts with seven). On your turn, play a card that matches the top of the discard pile by <strong>suit or rank</strong>, or play any <strong>8</strong> (wild) and name the next suit.</p>
          <p>No legal card? Draw from the stock until you get one. If the stock runs out and you still can't play, pass — the stock reshuffles from the discard pile when it empties.</p>
          <p>If everyone passes with a dead deck, the game ends and the smallest hand wins.</p>
        </GameRules>
      </div>

      {dealing ? (
        <Loading label="Dealing…" />
      ) : (
        <div className="flex flex-col items-center gap-5">
          {/* AI opponents */}
          <div className="flex flex-wrap justify-center gap-4">
            {opponents.map((seat) => (
              <div key={seat} className="flex flex-col items-center gap-1">
                <p className="text-xs uppercase tracking-widest text-gold/80">
                  {opponents.length > 1 ? `Seat ${seat + 1}` : 'Opponent'} —{' '}
                  {state.hands[seat].length} card{state.hands[seat].length === 1 ? '' : 's'}
                </p>
                <div className="flex">
                  {state.hands[seat].slice(0, 12).map((_, i) => (
                    <div key={i} className="-ml-6 first:ml-0 w-10">
                      <Card faceDown />
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
                    : 'Deadlock — an opponent had fewer cards. You lose.'
                  : state.winner === YOU
                    ? 'You went out — you win!'
                    : `Seat ${state.winner! + 1} went out. You lose.`}
              </p>
              {!state.stalemate && state.winner === YOU && opponentCardsLeft >= 1 && (
                <ScoreSubmit game="crazy-eights" score={opponentCardsLeft} />
              )}
              <Button size="lg" variant="gold" onClick={() => void newGame(seatCount)}>
                Play again
              </Button>
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}
