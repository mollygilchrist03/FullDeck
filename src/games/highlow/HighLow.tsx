import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Layout } from '../../components/Layout'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Loading, ErrorNotice } from '../../components/Loading'
import { useDeck } from '../../hooks/useDeck'
import { ScoreSubmit } from '../../components/ScoreSubmit'
import { GameRules } from '../../components/GameRules'
import { highLowReducer, initHighLow } from './highLowReducer'

const JUDGEMENT_TEXT = {
  correct: 'Correct!',
  push: 'Push — same rank. Carry on.',
  wrong: 'Wrong. Run over.',
} as const

export function HighLow() {
  const deck = useDeck()
  const [state, dispatch] = useReducer(highLowReducer, undefined, initHighLow)
  const [best, setBest] = useState(0)
  const [busy, setBusy] = useState(true)
  const didInit = useRef(false)

  const { drawCards } = deck

  const startRun = useCallback(async () => {
    setBusy(true)
    try {
      const [first] = await drawCards(1)
      dispatch({ type: 'START', first })
    } catch {
      /* surfaced via deck.error */
    } finally {
      setBusy(false)
    }
  }, [drawCards])

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    void startRun()
  }, [startRun])

  useEffect(() => {
    setBest((b) => Math.max(b, state.streak))
  }, [state.streak])

  const guess = useCallback(
    async (dir: 'higher' | 'lower') => {
      setBusy(true)
      try {
        const [next] = await drawCards(1)
        dispatch({ type: 'GUESS', guess: dir, next })
      } catch {
        /* surfaced via deck.error */
      } finally {
        setBusy(false)
      }
    },
    [drawCards],
  )

  const shown = state.revealed ?? state.current
  const won = state.phase === 'won'
  const over = state.phase === 'gameover' || won

  return (
    <Layout
      title="High-Low"
      action={
        <Button variant="gold" onClick={() => void startRun()} disabled={busy}>
          New run
        </Button>
      }
    >
      {deck.error && (
        <div className="mb-4">
          <ErrorNotice message={deck.error} onRetry={() => void startRun()} />
        </div>
      )}

      <div className="mb-4">
        <GameRules>
          <p>One card is face up. Call whether the <strong>next</strong> card will be higher or lower. Aces are high.</p>
          <p>Right: your streak grows and the new card becomes the one to beat. Wrong: the run ends. Same rank: a push — the streak holds and nothing changes.</p>
          <p>Your longest streak in a session is your score.</p>
        </GameRules>
      </div>

      {!shown && busy ? (
        <Loading label="Cutting the deck…" />
      ) : (
        <div className="flex flex-col items-center gap-6">
          <div className="flex gap-8 text-center">
            <div>
              <p className="text-xs uppercase tracking-widest text-gold/80">Streak</p>
              <p className="text-2xl font-bold tabular-nums text-card">{state.streak}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-gold/80">Best</p>
              <p className="text-2xl font-bold tabular-nums text-card">{best}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-gold/80">Seen</p>
              <p className="text-2xl font-bold tabular-nums text-card">{state.seen}</p>
            </div>
          </div>

          <div className="w-32 sm:w-40">{shown && <Card card={shown} faceDown={false} dealt />}</div>

          {state.lastJudgement && (
            <p
              className={`min-h-6 font-semibold ${
                state.lastJudgement === 'wrong'
                  ? 'text-casino'
                  : state.lastJudgement === 'correct'
                    ? 'text-gold'
                    : 'text-card/80'
              }`}
              role="status"
              aria-live="polite"
            >
              {JUDGEMENT_TEXT[state.lastJudgement]}
            </p>
          )}

          {state.phase === 'guessing' && (
            <>
              <p className="text-sm text-card/70">
                Will the next card be higher or lower? Ace is high; same rank is a push.
              </p>
              <div className="flex w-full max-w-md gap-3">
                <Button
                  size="lg"
                  variant="gold"
                  className="flex-1"
                  onClick={() => void guess('higher')}
                  disabled={busy}
                >
                  ▲ Higher
                </Button>
                <Button
                  size="lg"
                  variant="accent"
                  className="flex-1"
                  onClick={() => void guess('lower')}
                  disabled={busy}
                >
                  ▼ Lower
                </Button>
              </div>
            </>
          )}

          {state.phase === 'revealed' && (
            <Button size="lg" variant="gold" onClick={() => dispatch({ type: 'CONTINUE' })}>
              Next card
            </Button>
          )}

          {over && (
            <div className="flex flex-col items-center gap-3">
              <p className="font-display text-xl text-gold">
                {won
                  ? `You called all 52 cards — deck cleared!`
                  : `Run over at ${state.streak} — best this session: ${best}`}
              </p>
              {best >= 1 && <ScoreSubmit game="high-low" score={best} />}
              <Button size="lg" variant="gold" onClick={() => void startRun()}>
                Play again
              </Button>
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}
