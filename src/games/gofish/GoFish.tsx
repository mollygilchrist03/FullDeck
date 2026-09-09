import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Layout } from '../../components/Layout.js'
import { Button } from '../../components/Button.js'
import { Card } from '../../components/Card.js'
import { Loading, ErrorNotice } from '../../components/Loading.js'
import { GameRules } from '../../components/GameRules.js'
import { ScoreSubmit } from '../../components/ScoreSubmit.js'
import { useDeck } from '../../hooks/useDeck.js'
import { feedback } from '../../lib/feedback.js'
import { useRecordGameOnce } from '../../hooks/useRecordGame.js'
import type { Rank } from '../../types/card.js'
import { ranksIn } from './goFishLogic.js'
import { goFishReducer, initGoFish } from './goFishReducer.js'

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
const YOU = 0
const AI = 1

function Books({ label, books, mine }: { label: string; books: Rank[]; mine?: boolean }) {
  return (
    <div
      className={`rounded-lg border bg-felt-deep/60 px-3 py-2 ${
        mine ? 'border-gold' : 'border-gold/40'
      }`}
    >
      <p className="flex items-center justify-between gap-2 text-xs uppercase tracking-widest text-gold/80">
        <span>{label}</span>
        <span className="rounded bg-gold px-1.5 font-bold text-felt-deep">{books.length}</span>
      </p>
      <div className="mt-1.5 flex min-h-7 flex-wrap gap-1">
        {books.length === 0 ? (
          <span className="text-xs text-card/40">None yet</span>
        ) : (
          books.map((r) => (
            <span
              key={r}
              className="min-w-7 rounded bg-gold px-1.5 py-1 text-center text-sm font-bold text-felt-deep"
            >
              {RANK_SHORT[r]}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

export function GoFish() {
  const deck = useDeck()
  const [state, dispatch] = useReducer(goFishReducer, 2, initGoFish)
  const [dealing, setDealing] = useState(true)
  const didInit = useRef(false)

  const { drawCards } = deck

  const newGame = useCallback(async () => {
    setDealing(true)
    try {
      const c = await drawCards(52)
      feedback('deal')
      dispatch({ type: 'START', hands: [c.slice(0, 7), c.slice(7, 14)], stock: c.slice(14) })
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
    if (state.turn !== AI || (state.phase !== 'ask' && state.phase !== 'draw')) return
    const id = setTimeout(() => {
      feedback('flip')
      dispatch({ type: 'AI_STEP' })
    }, AI_STEP_MS)
    return () => clearTimeout(id)
  }, [state.phase, state.turn, state.aiSteps])

  useEffect(() => {
    if (state.phase === 'gameover') feedback(state.winner === YOU ? 'win' : 'lose')
  }, [state.phase, state.winner])

  useRecordGameOnce({
    terminal: state.phase === 'gameover',
    game: 'go-fish',
    score: state.books[YOU].length,
    detail: `${state.winner === YOU ? 'Won' : 'Lost'} ${state.books[YOU].length}–${state.books[AI].length}`,
  })

  const over = state.phase === 'gameover'
  const myTurn = state.turn === YOU
  const myRanks = ranksIn(state.hands[YOU]).sort(
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
              Dealer — {state.hands[AI].length} cards
            </p>
            <div className="flex">
              {state.hands[AI].slice(0, 12).map((_, i) => (
                <div key={i} className="-ml-6 w-10 first:ml-0">
                  <Card faceDown />
                </div>
              ))}
            </div>
          </div>

          <div className="grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
            <Books label="Your books" books={state.books[YOU]} mine />
            <Books label="Dealer books" books={state.books[AI]} />
          </div>

          {/* The stock — click it to fish when you've missed. */}
          <button
            type="button"
            onClick={() => {
              feedback('flip')
              dispatch({ type: 'DRAW' })
            }}
            disabled={!myTurn || state.phase !== 'draw'}
            className="flex flex-col items-center gap-1 disabled:opacity-60"
            aria-label="Draw from the stock"
          >
            <div className={`w-16 ${myTurn && state.phase === 'draw' ? 'animate-pulse-match' : ''}`}>
              <Card faceDown />
            </div>
            <span className="text-xs text-card/70">stock {state.stock.length}</span>
          </button>

          <p className="min-h-5 max-w-md text-center text-sm text-card/75" role="status" aria-live="polite">
            {state.log[state.log.length - 1]}
          </p>

          {/* Player hand */}
          <div className="flex flex-wrap justify-center gap-1">
            {state.hands[YOU].map((c, i) => (
              <div key={`${c.code}-${i}`} className="w-12 sm:w-14">
                <Card card={c} faceDown={false} />
              </div>
            ))}
          </div>

          {!over ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-card/70">
                {myTurn && state.phase === 'ask'
                  ? 'Ask the dealer for:'
                  : myTurn && state.phase === 'draw'
                    ? 'Go fish — tap the stock to draw.'
                    : 'Dealer is thinking…'}
              </p>
              {myTurn && state.phase === 'draw' ? (
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
                        dispatch({ type: 'ASK', rank: r, target: AI })
                      }}
                      disabled={!myTurn || state.phase !== 'ask'}
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
                {state.winner === YOU
                  ? `You win ${state.books[YOU].length}–${state.books[AI].length}!`
                  : `The dealer wins ${state.books[AI].length}–${state.books[YOU].length}.`}
              </p>
              {state.books[YOU].length >= 1 && (
                <ScoreSubmit game="go-fish" score={state.books[YOU].length} />
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
