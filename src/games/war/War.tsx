import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Layout } from '../../components/Layout'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Loading, ErrorNotice } from '../../components/Loading'
import { useDeck } from '../../hooks/useDeck'
import { ScoreSubmit } from '../../components/ScoreSubmit'
import { initWar, warReducer } from './warReducer'

function Pile({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-24 w-16 sm:h-28 sm:w-20">
        {count > 0 ? (
          <>
            {count > 2 && <Card faceDown className="absolute left-1 top-1 opacity-60" />}
            {count > 1 && <Card faceDown className="absolute left-0.5 top-0.5 opacity-80" />}
            <Card faceDown className="absolute inset-0" />
          </>
        ) : (
          <div className="h-full w-full rounded-[0.55rem] border border-dashed border-card/30" />
        )}
      </div>
      <p className="text-xs uppercase tracking-widest text-gold/80">{label}</p>
      <p className="text-lg font-bold tabular-nums text-card">{count}</p>
    </div>
  )
}

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

  const atWar = state.phase === 'war'
  const over = state.phase === 'gameover'
  const banner = over
    ? state.winner === 'player'
      ? 'You take the whole deck — you win!'
      : 'The dealer has every card. You lose.'
    : state.lastWinner && !atWar
      ? `${state.lastWinner === 'player' ? 'You' : 'Dealer'} won ${state.lastPotSize} card${state.lastPotSize === 1 ? '' : 's'}`
      : atWar
        ? `War! ${state.spoils.length} cards on the line — flip again.`
        : 'Flip a card. High card takes the pair; ties mean war.'

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

      {dealing ? (
        <Loading label="Splitting the deck…" />
      ) : (
        <div className="flex flex-col items-center gap-6">
          <div className="flex w-full max-w-md items-start justify-between">
            <Pile label="Dealer" count={state.dealerPile.length} />
            <div className="pt-8 text-center">
              <p className="text-xs uppercase tracking-widest text-gold/80">Battles</p>
              <p className="text-lg font-bold tabular-nums text-card">{state.battles}</p>
            </div>
            <Pile label="You" count={state.playerPile.length} />
          </div>

          <div className="flex min-h-[9rem] items-center justify-center gap-6">
            <div className="w-20 sm:w-24">
              {state.dealerCard ? (
                <Card card={state.dealerCard} faceDown={false} dealt />
              ) : (
                <div className="aspect-[5/7] w-full rounded-[0.55rem] border border-dashed border-card/25" />
              )}
            </div>
            <span className="font-display text-xl text-gold">vs</span>
            <div className="w-20 sm:w-24">
              {state.playerCard ? (
                <Card card={state.playerCard} faceDown={false} dealt />
              ) : (
                <div className="aspect-[5/7] w-full rounded-[0.55rem] border border-dashed border-card/25" />
              )}
            </div>
          </div>

          <p
            className={`min-h-6 text-center font-semibold ${
              over ? 'font-display text-xl text-gold' : atWar ? 'text-casino' : 'text-card/80'
            }`}
            role="status"
            aria-live="polite"
          >
            {banner}
          </p>

          {over ? (
            <div className="flex flex-col items-center gap-3">
              {state.winner === 'player' && (
                <ScoreSubmit game="war" score={state.battles} />
              )}
              <Button size="lg" variant="gold" onClick={() => void newGame()}>
                Play again
              </Button>
            </div>
          ) : (
            <Button size="lg" variant={atWar ? 'accent' : 'gold'} onClick={() => dispatch({ type: 'FLIP' })}>
              {atWar ? 'Go to war' : 'Battle'}
            </Button>
          )}
        </div>
      )}
    </Layout>
  )
}
