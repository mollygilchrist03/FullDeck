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
import { SEAT_RANGE } from '../../lib/multiplayer.js'
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
const MIN_SEATS = 2
const MAX_SEATS = SEAT_RANGE['go-fish'].max
const HAND_SIZE = 7

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
  const [seatCount, setSeatCount] = useState(2)
  const [started, setStarted] = useState(false)
  const [state, dispatch] = useReducer(goFishReducer, 2, initGoFish)
  const [dealing, setDealing] = useState(false)
  const [askTarget, setAskTarget] = useState<number | null>(null)
  const didInit = useRef(false)

  const { drawCards } = deck

  const newGame = useCallback(
    async (seats: number) => {
      setDealing(true)
      try {
        const c = await drawCards(52)
        const hands = Array.from({ length: seats }, (_, i) =>
          c.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE),
        )
        feedback('deal')
        dispatch({ type: 'START', hands, stock: c.slice(HAND_SIZE * seats) })
      } catch {
        /* surfaced via deck.error */
      } finally {
        setDealing(false)
      }
    },
    [drawCards],
  )

  useEffect(() => {
    if (!started || didInit.current) return
    didInit.current = true
    void newGame(seatCount)
  }, [started, newGame, seatCount])

  // Whichever AI seat's turn it is asks or draws.
  useEffect(() => {
    if (state.turn === YOU || (state.phase !== 'ask' && state.phase !== 'draw')) return
    const id = setTimeout(() => {
      feedback('flip')
      dispatch({ type: 'AI_STEP' })
    }, AI_STEP_MS)
    return () => clearTimeout(id)
  }, [state.phase, state.turn, state.aiSteps])

  useEffect(() => {
    if (state.phase === 'gameover') feedback(state.winner === YOU ? 'win' : 'lose')
  }, [state.phase, state.winner])

  useEffect(() => {
    setAskTarget(null)
  }, [state.turn])

  const opponentBooks = state.books.reduce(
    (sum, b, i) => (i === YOU ? sum : sum + b.length),
    0,
  )

  useRecordGameOnce({
    terminal: state.phase === 'gameover',
    game: 'go-fish',
    score: state.books[YOU].length,
    detail: `${state.winner === YOU ? 'Won' : 'Lost'} ${state.books[YOU].length}–${opponentBooks}`,
  })

  const over = state.phase === 'gameover'
  const myTurn = state.turn === YOU
  const opponents = state.hands.map((_, i) => i).filter((i) => i !== YOU)
  const myRanks = ranksIn(state.hands[YOU]).sort(
    (a, b) => Object.keys(RANK_SHORT).indexOf(a) - Object.keys(RANK_SHORT).indexOf(b),
  )
  const target = opponents.length === 1 ? opponents[0] : askTarget

  if (!started) {
    return (
      <Layout title="Go Fish">
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
      title="Go Fish"
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
          <p>Collect more sets of four (books) than anyone else. On your turn, ask another player for a rank you already hold at least one of.</p>
          <p>If they have any, you take all of them and ask again. If not — <strong>go fish</strong>: draw from the stock. Draw exactly what you asked for and you go again; otherwise play passes on.</p>
          <p>The game ends when all thirteen books are made. Your book count in a win is your score.</p>
        </GameRules>
      </div>

      {dealing ? (
        <Loading label="Dealing…" />
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-wrap justify-center gap-4">
            {opponents.map((seat) => (
              <div key={seat} className="flex flex-col items-center gap-1">
                <p className="text-xs uppercase tracking-widest text-gold/80">
                  {opponents.length > 1 ? `Seat ${seat + 1}` : 'Dealer'} — {state.hands[seat].length} cards
                </p>
                <div className="flex">
                  {state.hands[seat].slice(0, 12).map((_, i) => (
                    <div key={i} className="-ml-6 w-10 first:ml-0">
                      <Card faceDown />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
            <Books label="Your books" books={state.books[YOU]} mine />
            {opponents.map((seat) => (
              <Books
                key={seat}
                label={opponents.length > 1 ? `Seat ${seat + 1} books` : 'Dealer books'}
                books={state.books[seat]}
              />
            ))}
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
                {myTurn && state.phase === 'ask' && target === null
                  ? 'Ask which seat?'
                  : myTurn && state.phase === 'ask'
                    ? `Ask ${opponents.length > 1 ? `Seat ${target! + 1}` : 'the dealer'} for:`
                    : myTurn && state.phase === 'draw'
                      ? 'Go fish — tap the stock to draw.'
                      : 'Waiting on the table…'}
                {myTurn && state.phase === 'ask' && target !== null && opponents.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setAskTarget(null)}
                    className="ml-2 text-xs text-gold underline underline-offset-2"
                  >
                    change
                  </button>
                )}
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
              ) : myTurn && state.phase === 'ask' && target === null ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {opponents.map((seat) => (
                    <Button key={seat} variant="ghost" onClick={() => setAskTarget(seat)}>
                      Seat {seat + 1} ({state.hands[seat].length})
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  {myRanks.map((r) => (
                    <Button
                      key={r}
                      variant="gold"
                      onClick={() => {
                        feedback('flip')
                        dispatch({ type: 'ASK', rank: r, target: target! })
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
                  ? `You win ${state.books[YOU].length}–${opponentBooks}!`
                  : `Seat ${state.winner! + 1} wins ${state.books[state.winner!].length}–${state.books[YOU].length}.`}
              </p>
              {state.books[YOU].length >= 1 && (
                <ScoreSubmit game="go-fish" score={state.books[YOU].length} />
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
