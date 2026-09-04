import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Layout } from '../../components/Layout'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Loading, ErrorNotice } from '../../components/Loading'
import { GameRules } from '../../components/GameRules'
import { ScoreSubmit } from '../../components/ScoreSubmit'
import { useDeck } from '../../hooks/useDeck'
import { removeOneQueen } from './oldMaidLogic'
import { initOldMaid, oldMaidReducer } from './oldMaidReducer'

const AI_STEP_MS = 900

export function OldMaid() {
  const deck = useDeck()
  const [state, dispatch] = useReducer(oldMaidReducer, undefined, initOldMaid)
  const [dealing, setDealing] = useState(true)
  const didInit = useRef(false)

  const { drawCards } = deck

  const newGame = useCallback(async () => {
    setDealing(true)
    try {
      const cards = removeOneQueen(await drawCards(52))
      dispatch({ type: 'START', playerHand: cards.slice(0, 26), aiHand: cards.slice(26) })
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
    if (state.phase !== 'aiTurn') return
    const id = setTimeout(() => {
      dispatch({ type: 'DRAW', index: Math.floor(Math.random() * state.playerHand.length) })
    }, AI_STEP_MS)
    return () => clearTimeout(id)
  }, [state.phase, state.playerHand.length])

  const over = state.phase === 'gameover'
  const myTurn = state.phase === 'playerTurn'

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
              Dealer — {state.aiHand.length} cards · {state.aiDiscards.length} pairs down
            </p>
            <div className="flex flex-wrap justify-center">
              {state.aiHand.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={!myTurn}
                  onClick={() => dispatch({ type: 'DRAW', index: i })}
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
              You — {state.playerDiscards.length} pairs down
            </p>
            <div className="flex flex-wrap justify-center gap-1">
              {state.playerHand.map((c, i) => (
                <div key={`${c.code}-${i}`} className="w-11 sm:w-12">
                  <Card card={c} faceDown={false} />
                </div>
              ))}
            </div>
          </div>

          {over && (
            <div className="flex flex-col items-center gap-3">
              <p className="font-display text-xl text-gold">
                {state.winner === 'player'
                  ? 'The dealer is the Old Maid — you win!'
                  : "You're stuck with the Old Maid. You lose."}
              </p>
              {state.winner === 'player' && state.turnsTaken >= 1 && (
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
