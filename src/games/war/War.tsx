import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Layout } from '../../components/Layout'
import { Button } from '../../components/Button'
import { Loading, ErrorNotice } from '../../components/Loading'
import { useDeck } from '../../hooks/useDeck'
import { ScoreSubmit } from '../../components/ScoreSubmit'
import { GameRules } from '../../components/GameRules'
import { initWar, warReducer } from './warReducer'
import { WarBoard } from './WarBoard'

export function War() {
  const deck = useDeck()
  const [state, dispatch] = useReducer(warReducer, undefined, initWar)
  const [dealing, setDealing] = useState(true)
  const didInit = useRef(false)

  const { drawCards } = deck

  const newGame = useCallback(async () => {
    setDealing(true)
    try {
      const cards = await drawCards(52)
      dispatch({ type: 'START', playerPile: cards.slice(0, 26), dealerPile: cards.slice(26) })
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

  const over = state.phase === 'gameover'

  return (
    <Layout
      title="War"
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
          <p>The deck is split evenly between you and the dealer. Each battle you both turn your top card face up; the higher rank wins the pair (aces high). Won cards go to the bottom of the winner's pile.</p>
          <p>Equal ranks mean <strong>war</strong>: on the next flip each side lays three cards face down and one face up, and the higher face-up card takes everything on the table. Another tie repeats it. Short on cards? You lay what you can and turn up your last card — run out entirely and you lose.</p>
          <p>Win by collecting all 52 cards. Fewer battles is a better score.</p>
        </GameRules>
      </div>

      {dealing ? (
        <Loading label="Splitting the deck…" />
      ) : (
        <div className="flex flex-col items-center gap-4">
          <WarBoard state={state} mySeat={0} onFlip={() => dispatch({ type: 'FLIP' })} />
          {over && (
            <div className="flex flex-col items-center gap-3">
              {state.winner === 'player' && <ScoreSubmit game="war" score={state.battles} />}
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
