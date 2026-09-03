import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Layout } from '../../components/Layout'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Loading, ErrorNotice } from '../../components/Loading'
import { useDeck } from '../../hooks/useDeck'
import { ScoreSubmit } from '../../components/ScoreSubmit'
import type { Suit } from '../../types/card'
import { isPlayable, SUITS } from './crazyEightsLogic'
import {
  canDraw,
  crazyEightsReducer,
  HAND_SIZE,
  initCrazyEights,
  playerHasMove,
  topCard,
} from './crazyEightsReducer'

const SUIT_GLYPH: Record<Suit, string> = {
  HEARTS: '♥',
  DIAMONDS: '♦',
  CLUBS: '♣',
  SPADES: '♠',
}
const isRed = (s: Suit) => s === 'HEARTS' || s === 'DIAMONDS'
const AI_STEP_MS = 900

export function CrazyEights() {
  const deck = useDeck()
  const [state, dispatch] = useReducer(crazyEightsReducer, undefined, initCrazyEights)
  const [dealing, setDealing] = useState(true)
  const didInit = useRef(false)

  const { startNewDeck, drawCards } = deck

  const newGame = useCallback(async () => {
    setDealing(true)
    try {
      await startNewDeck()
      const cards = await drawCards(HAND_SIZE * 2 + 4)
      const playerHand = cards.slice(0, HAND_SIZE)
      const aiHand = cards.slice(HAND_SIZE, HAND_SIZE * 2)
      const rest = cards.slice(HAND_SIZE * 2)
      // The starter can't be an 8 (it would need a suit nomination up front).
      const starterIdx = rest.findIndex((c) => c.rank !== '8')
      const discard = [rest[starterIdx]]
      const stock = rest.filter((_, i) => i !== starterIdx)
      dispatch({
        type: 'START',
        stock,
        discard,
        playerHand,
        aiHand,
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
    if (state.phase !== 'aiTurn') return
    const t = setTimeout(() => dispatch({ type: 'AI_STEP' }), AI_STEP_MS)
    return () => clearTimeout(t)
  }, [state.phase, state.aiSteps])

  const top = state.discard.length ? topCard(state) : null
  const myTurn = state.phase === 'playerTurn'
  const legal = (i: number) =>
    top ? isPlayable(state.playerHand[i], top, state.activeSuit) : false
  const hasMove = myTurn && playerHasMove(state)
  const mustDraw = myTurn && !hasMove && canDraw(state)
  const mustPass = myTurn && !hasMove && !canDraw(state)
  const over = state.phase === 'gameover'

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

      {dealing ? (
        <Loading label="Dealing…" />
      ) : (
        <div className="flex flex-col items-center gap-5">
          {/* AI */}
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs uppercase tracking-widest text-gold/80">
              Opponent — {state.aiHand.length} card{state.aiHand.length === 1 ? '' : 's'}
            </p>
            <div className="flex">
              {state.aiHand.slice(0, 12).map((_, i) => (
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
              onClick={() => dispatch({ type: 'DRAW' })}
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
                    onClick={() => dispatch({ type: 'CHOOSE_SUIT', suit: s })}
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
          <div className="flex flex-wrap justify-center gap-1">
            {state.playerHand.map((c, i) => (
              <div key={`${c.code}-${i}`} className="w-14 sm:w-16">
                <Card
                  card={c}
                  faceDown={false}
                  onClick={myTurn && legal(i) ? () => dispatch({ type: 'PLAY', index: i }) : undefined}
                  disabled={!myTurn || !legal(i)}
                  className={myTurn && legal(i) ? 'ring-2 ring-gold' : 'opacity-55'}
                />
              </div>
            ))}
          </div>

          {/* Controls */}
          {myTurn && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => dispatch({ type: 'DRAW' })} disabled={!mustDraw}>
                  Draw
                </Button>
                <Button
                  variant="accent"
                  onClick={() => dispatch({ type: 'PASS' })}
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
                  ? state.winner === 'player'
                    ? 'Deadlock — you had fewer cards. You win.'
                    : 'Deadlock — the AI had fewer cards. You lose.'
                  : state.winner === 'player'
                    ? 'You went out — you win!'
                    : 'The AI went out. You lose.'}
              </p>
              {!state.stalemate && state.winner === 'player' && state.aiHand.length >= 1 && (
                <ScoreSubmit game="crazy-eights" score={state.aiHand.length} />
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
