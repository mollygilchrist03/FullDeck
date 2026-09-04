import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Layout } from '../../components/Layout'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Loading, ErrorNotice } from '../../components/Loading'
import { GameRules } from '../../components/GameRules'
import { ScoreSubmit } from '../../components/ScoreSubmit'
import { useDeck } from '../../hooks/useDeck'
import { feedback } from '../../lib/feedback'
import type { Rank } from '../../types/card'
import { ranksIn } from './goFishLogic'
import { goFishReducer, initGoFish } from './goFishReducer'

const RANK_SHORT: Record<Rank, string> = {
  ACE: 'A',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  JACK: 'J',
  QUEEN: 'Q',
  KING: 'K',
}
const AI_STEP_MS = 950

function Books({ label, books }: { label: string; books: Rank[] }) {
  return (
    <div className="text-center">
      <p className="text-xs uppercase tracking-widest text-gold/80">
        {label} — {books.length}
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-1">
        {books.map((r) => (
          <span key={r} className="rounded bg-gold/20 px-1.5 py-0.5 text-xs font-bold text-gold">
            {RANK_SHORT[r]}
          </span>
        ))}
      </div>
    </div>
  )
}

export function GoFish() {
  const deck = useDeck()
  const [state, dispatch] = useReducer(goFishReducer, undefined, initGoFish)
  const [dealing, setDealing] = useState(true)
  const didInit = useRef(false)

  const { drawCards } = deck

  const newGame = useCallback(async () => {
    setDealing(true)
    try {
      const c = await drawCards(52)
      feedback('deal')
      dispatch({ type: 'START', playerHand: c.slice(0, 7), aiHand: c.slice(7, 14), stock: c.slice(14) })
    } catch {
      /* surfaced via deck.error */
    } finally {
      setDealing(false)
    }
  }, [drawCards])

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    void newGame()
  }, [newGame])

  useEffect(() => {
    if (state.phase !== 'aiAsk' && state.phase !== 'aiDraw') return
    const id = setTimeout(() => {
      feedback('flip')
      dispatch({ type: 'AI_STEP' })
    }, AI_STEP_MS)
    return () => clearTimeout(id)
  }, [state.phase, state.aiSteps])

  useEffect(() => {
    if (state.phase === 'gameover') feedback(state.winner === 'player' ? 'win' : 'lose')
  }, [state.phase, state.winner])

  const over = state.phase === 'gameover'
  const myRanks = ranksIn(state.playerHand).sort(
    (a, b) => Object.keys(RANK_SHORT).indexOf(a) - Object.keys(RANK_SHORT).indexOf(b),
  )

  return (
    <Layout
      title="Go Fish"
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
          <p>Collect more sets of four (books) than the dealer. On your turn, ask the dealer for a rank you already hold at least one of.</p>
          <p>If they have any, you take all of them and ask again. If not — <strong>go fish</strong>: draw from the stock. Draw exactly what you asked for and you go again; otherwise it's the dealer's turn.</p>
          <p>The game ends when all thirteen books are made. Your book count in a win is your score.</p>
        </GameRules>
      </div>

      {dealing ? (
        <Loading label="Dealing…" />
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs uppercase tracking-widest text-gold/80">
              Dealer — {state.aiHand.length} cards
            </p>
            <div className="flex">
              {state.aiHand.slice(0, 12).map((_, i) => (
                <div key={i} className="-ml-6 w-10 first:ml-0">
                  <Card faceDown />
                </div>
              ))}
            </div>
          </div>

          <div className="flex w-full max-w-md justify-around">
            <Books label="Dealer books" books={state.aiBooks} />
            <Books label="Your books" books={state.playerBooks} />
          </div>

          {/* The stock — click it to fish when you've missed. */}
          <button
            type="button"
            onClick={() => {
              feedback('flip')
              dispatch({ type: 'DRAW' })
            }}
            disabled={state.phase !== 'playerDraw'}
            className="flex flex-col items-center gap-1 disabled:opacity-60"
            aria-label="Draw from the stock"
          >
            <div className={`w-16 ${state.phase === 'playerDraw' ? 'animate-pulse-match' : ''}`}>
              <Card faceDown />
            </div>
            <span className="text-xs text-card/70">stock {state.stock.length}</span>
          </button>

          <p className="min-h-5 max-w-md text-center text-sm text-card/75" role="status" aria-live="polite">
            {state.log[state.log.length - 1]}
          </p>

          {/* Player hand */}
          <div className="flex flex-wrap justify-center gap-1">
            {state.playerHand.map((c, i) => (
              <div key={`${c.code}-${i}`} className="w-12 sm:w-14">
                <Card card={c} faceDown={false} />
              </div>
            ))}
          </div>

          {!over ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-card/70">
                {state.phase === 'playerAsk'
                  ? 'Ask the dealer for:'
                  : state.phase === 'playerDraw'
                    ? 'Go fish — tap the stock to draw.'
                    : 'Dealer is thinking…'}
              </p>
              {state.phase === 'playerDraw' ? (
                <Button
                  size="lg"
                  variant="accent"
                  onClick={() => {
                    feedback('flip')
                    dispatch({ type: 'DRAW' })
                  }}
                >
                  🎣 Go fish
                </Button>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  {myRanks.map((r) => (
                    <Button
                      key={r}
                      variant="gold"
                      onClick={() => {
                        feedback('flip')
                        dispatch({ type: 'ASK', rank: r })
                      }}
                      disabled={state.phase !== 'playerAsk'}
                    >
                      {RANK_SHORT[r]}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="font-display text-xl text-gold">
                {state.winner === 'player'
                  ? `You win ${state.playerBooks.length}–${state.aiBooks.length}!`
                  : `The dealer wins ${state.aiBooks.length}–${state.playerBooks.length}.`}
              </p>
              {state.playerBooks.length >= 1 && (
                <ScoreSubmit game="go-fish" score={state.playerBooks.length} />
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
