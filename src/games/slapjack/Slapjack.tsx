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
import { centerTop, initSlapjack, isJack, slapjackReducer } from './slapjackReducer.js'

const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo))

export function Slapjack() {
  const deck = useDeck()
  const [state, dispatch] = useReducer(slapjackReducer, undefined, initSlapjack)
  const [dealing, setDealing] = useState(true)
  const [bestMs, setBestMs] = useState<number | null>(null)
  const didInit = useRef(false)
  const slapOpenedAt = useRef<number | null>(null)
  const flipTick = useRef(0)

  const { drawCards } = deck

  const newGame = useCallback(async () => {
    setDealing(true)
    setBestMs(null)
    try {
      const cards = await drawCards(52)
      feedback('deal')
      dispatch({ type: 'START', playerPile: cards.slice(0, 26), aiPile: cards.slice(26) })
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

  // The dealer flips on its turn.
  useEffect(() => {
    if (state.phase !== 'flipping' || state.turn !== 'ai') return
    flipTick.current += 1
    const id = setTimeout(() => {
      feedback('flip')
      dispatch({ type: 'FLIP' })
    }, rand(500, 950))
    return () => clearTimeout(id)
  }, [state.phase, state.turn, state.center.length])

  // A Jack is showing: open the reaction window and schedule the dealer's slap.
  // ~600-1400ms is a real human-beatable reaction; one round in five the
  // dealer "hesitates" and is a beat or two slower, so an alert player
  // reliably takes those. It always slaps eventually, so the game can't stall.
  useEffect(() => {
    if (state.phase !== 'slap') {
      slapOpenedAt.current = null
      return
    }
    slapOpenedAt.current = performance.now()
    const delay = rand(600, 1400) + (Math.random() < 0.2 ? rand(1400, 3000) : 0)
    const id = setTimeout(() => {
      feedback('slap')
      dispatch({ type: 'SLAP', who: 'ai' })
    }, delay)
    return () => clearTimeout(id)
  }, [state.phase, state.center.length])

  useEffect(() => {
    if (state.phase === 'gameover') feedback(state.winner === 'player' ? 'win' : 'lose')
  }, [state.phase, state.winner])

  useRecordGameOnce({
    terminal: state.phase === 'gameover',
    game: 'slapjack',
    score: state.winner === 'player' && bestMs != null ? bestMs : 0,
    detail:
      state.winner === 'player'
        ? bestMs != null
          ? `Won — fastest slap ${bestMs}ms`
          : 'Won'
        : 'Lost',
  })

  const slap = () => {
    feedback('slap')
    if (state.phase === 'slap' && slapOpenedAt.current != null) {
      const ms = Math.round(performance.now() - slapOpenedAt.current)
      setBestMs((b) => (b == null ? ms : Math.min(b, ms)))
    }
    dispatch({ type: 'SLAP', who: 'player' })
  }

  const over = state.phase === 'gameover'
  const jackUp = state.phase === 'slap' && isJack(centerTop(state))
  const canFlip = state.phase === 'flipping' && state.turn === 'player'

  return (
    <Layout
      title="Slapjack"
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
          <p>The deck is split evenly, face down. You and the dealer take turns flipping your top card onto the centre pile.</p>
          <p>When a <strong>Jack</strong> lands, be first to hit <strong>Slap</strong> — the slapper takes the whole centre pile. Slap on anything else and you forfeit a card to the other side.</p>
          <p>Collect all 52 cards to win. Your fastest winning slap is your score.</p>
        </GameRules>
      </div>

      {dealing ? (
        <Loading label="Splitting the deck…" />
      ) : (
        <div className="flex flex-col items-center gap-5">
          <div className="flex w-full max-w-sm justify-between text-center">
            <div>
              <p className="text-xs uppercase tracking-widest text-gold/80">Dealer</p>
              <p className="text-2xl font-bold tabular-nums text-card">{state.aiPile.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-gold/80">Centre</p>
              <p className="text-2xl font-bold tabular-nums text-card">{state.center.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-gold/80">You</p>
              <p className="text-2xl font-bold tabular-nums text-card">{state.playerPile.length}</p>
            </div>
          </div>

          <div
            className={`w-24 rounded-[0.6rem] transition-shadow sm:w-28 ${
              jackUp ? 'shadow-[0_0_0_6px_rgba(230,57,70,0.6)]' : ''
            }`}
          >
            {centerTop(state) ? (
              <Card card={centerTop(state)} faceDown={false} dealt />
            ) : (
              <div className="aspect-[5/7] w-full rounded-[0.55rem] border border-dashed border-card/25" />
            )}
          </div>

          <p className="min-h-5 text-center text-sm text-card/75" role="status" aria-live="polite">
            {state.log[state.log.length - 1]}
          </p>

          {!over ? (
            <div className="flex w-full max-w-sm gap-3">
              <Button
                size="lg"
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  feedback('flip')
                  dispatch({ type: 'FLIP' })
                }}
                disabled={!canFlip}
              >
                Flip
              </Button>
              <Button size="lg" variant="accent" className="flex-1" onClick={slap}>
                Slap!
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="font-display text-xl text-gold">
                {state.winner === 'player' ? 'You hold every card — you win!' : 'The dealer swept the deck. You lose.'}
              </p>
              {state.winner === 'player' && bestMs != null && (
                <ScoreSubmit game="slapjack" score={bestMs} />
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
