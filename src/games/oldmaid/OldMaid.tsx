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
import { SEAT_RANGE } from '../../lib/multiplayer.js'
import { removeOneQueen } from './oldMaidLogic.js'
import { initOldMaid, nextLiveSeat, oldMaidReducer } from './oldMaidReducer.js'

const AI_STEP_MS = 900
const YOU = 0
const MIN_SEATS = 2
const MAX_SEATS = SEAT_RANGE['old-maid'].max

export function OldMaid() {
  const deck = useDeck()
  const [seatCount, setSeatCount] = useState(2)
  const [started, setStarted] = useState(false)
  const [state, dispatch] = useReducer(oldMaidReducer, 2, initOldMaid)
  const [dealing, setDealing] = useState(false)
  const didInit = useRef(false)

  const { drawCards } = deck

  const newGame = useCallback(
    async (seats: number) => {
      setDealing(true)
      try {
        const cards = removeOneQueen(await drawCards(52))
        feedback('deal')
        // 51 cards after removing a Queen doesn't divide evenly — the first
        // few seats get one extra card each.
        const base = Math.floor(cards.length / seats)
        const extra = cards.length % seats
        const hands: (typeof cards)[] = []
        let at = 0
        for (let i = 0; i < seats; i += 1) {
          const size = base + (i < extra ? 1 : 0)
          hands.push(cards.slice(at, at + size))
          at += size
        }
        dispatch({ type: 'START', hands })
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

  // Whichever AI seat's turn it is draws a random card from whoever's next.
  useEffect(() => {
    if (state.phase !== 'turn' || state.turn === YOU) return
    const drawer = state.turn
    const target = nextLiveSeat(state.hands, drawer)
    const id = setTimeout(() => {
      feedback('flip')
      dispatch({ type: 'DRAW', index: Math.floor(Math.random() * state.hands[target].length) })
    }, AI_STEP_MS)
    return () => clearTimeout(id)
  }, [state.phase, state.turn, state.hands])

  useEffect(() => {
    if (state.phase === 'gameover') feedback(state.loser === YOU ? 'lose' : 'win')
  }, [state.phase, state.loser])

  useRecordGameOnce({
    terminal: state.phase === 'gameover',
    game: 'old-maid',
    score: state.loser !== YOU ? state.turnsTaken : 0,
    detail:
      state.loser !== YOU
        ? `Won in ${state.turnsTaken} draws`
        : 'Lost — held the Old Maid',
  })

  const over = state.phase === 'gameover'
  const myTurn = state.phase === 'turn' && state.turn === YOU
  const drawTarget = state.phase === 'turn' ? nextLiveSeat(state.hands, state.turn) : YOU
  const opponents = state.hands.map((_, i) => i).filter((i) => i !== YOU)

  if (!started) {
    return (
      <Layout title="Old Maid">
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
      title="Old Maid"
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
          <p>One Queen is removed from the deck, so a single Queen has no partner — that's the Old Maid. All cards are dealt out and every pair is laid down straight away.</p>
          <p>On your turn, take one card at random from the next seat's face-down hand; if it pairs with one of yours, discard the pair. Then play passes on. A seat that empties its hand is skipped for the rest of the game.</p>
          <p>Whoever is left holding the lone Queen at the end loses. Fewest draws before that happens is your score.</p>
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
                  {opponents.length > 1 ? `Seat ${seat + 1}` : 'Dealer'} — {state.hands[seat].length} cards ·{' '}
                  {state.discards[seat].length} pairs down
                </p>
                <div className="flex flex-wrap justify-center">
                  {state.hands[seat].map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={!myTurn || drawTarget !== seat}
                      onClick={() => {
                        feedback('flip')
                        dispatch({ type: 'DRAW', index: i })
                      }}
                      className={`-ml-5 w-10 transition-transform first:ml-0 ${
                        myTurn && drawTarget === seat ? 'hover:-translate-y-2' : ''
                      }`}
                      aria-label={`Take Seat ${seat + 1}'s card ${i + 1}`}
                    >
                      <Card faceDown />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="min-h-5 max-w-md text-center text-sm text-card/75" role="status" aria-live="polite">
            {myTurn
              ? `Your turn — take a card from ${opponents.length > 1 ? `Seat ${drawTarget + 1}` : 'the dealer'}.`
              : state.log[state.log.length - 1]}
          </p>

          <div className="flex flex-col items-center gap-1">
            <p className="text-xs uppercase tracking-widest text-gold/80">
              You — {state.discards[YOU].length} pairs down
            </p>
            <div className="flex flex-wrap justify-center gap-1">
              {state.hands[YOU].map((c, i) => (
                <div key={`${c.code}-${i}`} className="w-11 sm:w-12">
                  <Card card={c} faceDown={false} />
                </div>
              ))}
            </div>
          </div>

          {over && (
            <div className="flex flex-col items-center gap-3">
              <p className="font-display text-xl text-gold">
                {state.loser !== YOU
                  ? opponents.length > 1
                    ? `Seat ${state.loser! + 1} is the Old Maid — you win!`
                    : 'The dealer is the Old Maid — you win!'
                  : "You're stuck with the Old Maid. You lose."}
              </p>
              {state.loser !== YOU && state.turnsTaken >= 1 && (
                <ScoreSubmit game="old-maid" score={state.turnsTaken} />
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
