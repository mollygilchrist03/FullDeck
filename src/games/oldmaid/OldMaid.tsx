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
import { removeOneQueen } from './oldMaidLogic.js'
import { initOldMaid, oldMaidReducer } from './oldMaidReducer.js'

const AI_STEP_MS = 900
const YOU = 0
const AI = 1

export function OldMaid() {
  const deck = useDeck()
  const [state, dispatch] = useReducer(oldMaidReducer, 2, initOldMaid)
  const [dealing, setDealing] = useState(true)
  const didInit = useRef(false)

  const { drawCards } = deck

  const newGame = useCallback(async () => {
    setDealing(true)
    try {
      const cards = removeOneQueen(await drawCards(52))
      feedback('deal')
      dispatch({ type: 'START', hands: [cards.slice(0, 26), cards.slice(26)] })
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

  // The dealer draws a random card from your hand on its turn.
  useEffect(() => {
    if (state.phase !== 'turn' || state.turn !== AI) return
    const id = setTimeout(() => {
      feedback('flip')
      dispatch({ type: 'DRAW', index: Math.floor(Math.random() * state.hands[YOU].length) })
    }, AI_STEP_MS)
    return () => clearTimeout(id)
  }, [state.phase, state.turn, state.hands])

  useEffect(() => {
    if (state.phase === 'gameover') feedback(state.loser === AI ? 'win' : 'lose')
  }, [state.phase, state.loser])

  useRecordGameOnce({
    terminal: state.phase === 'gameover',
    game: 'old-maid',
    score: state.loser === AI ? state.turnsTaken : 0,
    detail:
      state.loser === AI
        ? `Won in ${state.turnsTaken} draws`
        : 'Lost — held the Old Maid',
  })

  const over = state.phase === 'gameover'
  const myTurn = state.phase === 'turn' && state.turn === YOU

  return (
    <Layout
      title="Old Maid"
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
          <p>One Queen is removed from the deck, so a single Queen has no partner — that's the Old Maid. All cards are dealt out and every pair is laid down straight away.</p>
          <p>On your turn, take one card at random from the dealer's face-down hand; if it pairs with one of yours, discard the pair. Then the dealer does the same to you. Whoever is left holding the lone Queen at the end loses.</p>
          <p>Fewest draws before the dealer is stuck with it is your score.</p>
        </GameRules>
      </div>

      {dealing ? (
        <Loading label="Dealing…" />
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs uppercase tracking-widest text-gold/80">
              Dealer — {state.hands[AI].length} cards · {state.discards[AI].length} pairs down
            </p>
            <div className="flex flex-wrap justify-center">
              {state.hands[AI].map((_, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={!myTurn}
                  onClick={() => {
                    feedback('flip')
                    dispatch({ type: 'DRAW', index: i })
                  }}
                  className={`-ml-5 w-10 transition-transform first:ml-0 ${
                    myTurn ? 'hover:-translate-y-2' : ''
                  }`}
                  aria-label={`Take the dealer's card ${i + 1}`}
                >
                  <Card faceDown />
                </button>
              ))}
            </div>
          </div>

          <p className="min-h-5 max-w-md text-center text-sm text-card/75" role="status" aria-live="polite">
            {myTurn ? 'Your turn — take a card from the dealer.' : state.log[state.log.length - 1]}
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
                {state.loser === AI
                  ? 'The dealer is the Old Maid — you win!'
                  : "You're stuck with the Old Maid. You lose."}
              </p>
              {state.loser === AI && state.turnsTaken >= 1 && (
                <ScoreSubmit game="old-maid" score={state.turnsTaken} />
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
