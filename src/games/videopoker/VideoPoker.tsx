import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Layout } from '../../components/Layout'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Loading, ErrorNotice } from '../../components/Loading'
import { useDeck } from '../../hooks/useDeck'
import { ScoreSubmit } from '../../components/ScoreSubmit'
import { CATEGORY_LABEL } from './pokerHand'
import { MAX_BET, PAY_PER_CREDIT } from './paytable'
import {
  drawSlots,
  initVideoPoker,
  videoPokerReducer,
  STARTING_BANK,
} from './videoPokerReducer'

const PAY_ROWS = (
  Object.keys(PAY_PER_CREDIT) as (keyof typeof PAY_PER_CREDIT)[]
).filter((k) => k !== 'nothing')

function Paytable({ bet, highlight }: { bet: number; highlight?: string }) {
  return (
    <table className="w-full max-w-xs border-collapse text-sm">
      <tbody>
        {PAY_ROWS.map((cat) => (
          <tr
            key={cat}
            className={`border-b border-gold/15 ${
              highlight === cat ? 'bg-gold/20 font-bold text-gold' : 'text-card/85'
            }`}
          >
            <td className="py-1 pr-2">{CATEGORY_LABEL[cat]}</td>
            <td className="py-1 text-right tabular-nums">
              {cat === 'royal-flush' && bet === MAX_BET ? 4000 : PAY_PER_CREDIT[cat] * bet}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function VideoPoker() {
  const deck = useDeck()
  const [state, dispatch] = useReducer(videoPokerReducer, undefined, initVideoPoker)
  const [busy, setBusy] = useState(false)
  const [bestWin, setBestWin] = useState(0)
  const didInit = useRef(false)

  useEffect(() => {
    if (state.result) setBestWin((b) => Math.max(b, state.result!.payout))
  }, [state.result])

  const { startNewDeck, drawCards } = deck

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    void startNewDeck()
  }, [startNewDeck])

  const deal = useCallback(async () => {
    setBusy(true)
    try {
      const cards = await drawCards(5)
      dispatch({ type: 'DEAL', cards })
    } catch {
      /* surfaced via deck.error */
    } finally {
      setBusy(false)
    }
  }, [drawCards])

  const draw = useCallback(async () => {
    setBusy(true)
    try {
      const need = drawSlots(state.held).length
      const replacements = need > 0 ? await drawCards(need) : []
      dispatch({ type: 'DRAW', replacements })
    } catch {
      /* surfaced via deck.error */
    } finally {
      setBusy(false)
    }
  }, [drawCards, state.held])

  const outOfChips = state.phase === 'bet' && state.bank < 1

  return (
    <Layout
      title="Video Poker"
      action={
        state.phase === 'result' ? (
          <Button variant="gold" onClick={() => dispatch({ type: 'NEW_HAND' })}>
            New hand
          </Button>
        ) : null
      }
    >
      {deck.error && (
        <div className="mb-4">
          <ErrorNotice message={deck.error} onRetry={() => void startNewDeck()} />
        </div>
      )}

      {!deck.deckId && deck.loading ? (
        <Loading />
      ) : (
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-wrap items-center justify-center gap-4 text-center">
            <div>
              <p className="text-xs uppercase tracking-widest text-gold/80">Bank</p>
              <p className="text-xl font-bold tabular-nums text-card">${state.bank}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-gold/80">Bet</p>
              <p className="text-xl font-bold tabular-nums text-casino">{state.bet}</p>
            </div>
            <p className="text-xs text-card/60">{deck.remaining} left</p>
          </div>

          {/* Hand */}
          <div className="flex justify-center gap-2 sm:gap-3">
            {(state.hand.length ? state.hand : Array.from({ length: 5 })).map((_, i) => {
              const cardData = state.hand[i]
              const canHold = state.phase === 'holding' && !busy
              return (
                <div key={`${state.handId}-${i}`} className="w-16 sm:w-20">
                  <div className="mb-1 h-4 text-center text-[0.65rem] font-bold uppercase tracking-widest text-gold">
                    {state.held[i] && state.phase !== 'bet' ? 'Held' : ' '}
                  </div>
                  {cardData ? (
                    <Card
                      card={cardData}
                      faceDown={false}
                      dealt
                      onClick={canHold ? () => dispatch({ type: 'TOGGLE_HOLD', index: i }) : undefined}
                      className={state.held[i] && state.phase === 'holding' ? 'ring-2 ring-gold' : ''}
                    />
                  ) : (
                    <div className="aspect-[5/7] w-full rounded-[0.55rem] border border-dashed border-card/25" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Result */}
          {state.phase === 'result' && state.result && (
            <div
              className={`animate-deal rounded-xl border px-5 py-3 text-center ${
                state.result.payout > 0
                  ? 'border-gold bg-gold/15 text-gold'
                  : 'border-casino bg-casino/15 text-casino'
              }`}
              role="status"
              aria-live="polite"
            >
              <p className="font-display text-xl font-bold">
                {CATEGORY_LABEL[state.result.category]}
              </p>
              <p className="text-sm font-semibold tabular-nums">
                {state.result.payout > 0 ? `+$${state.result.payout}` : `-$${state.bet}`}
              </p>
            </div>
          )}

          {state.phase === 'result' && bestWin >= 1 && (
            <ScoreSubmit game="video-poker" score={bestWin} />
          )}

          {/* Controls */}
          {state.phase === 'bet' &&
            (outOfChips ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-casino/50 bg-casino/10 p-5 text-center">
                <p className="text-card">Out of credits.</p>
                <Button variant="gold" onClick={() => dispatch({ type: 'RESET_BANK' })}>
                  Reset to ${STARTING_BANK}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2">
                  {Array.from({ length: MAX_BET }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => dispatch({ type: 'SET_BET', amount: n })}
                      disabled={n > state.bank}
                      className={`h-11 w-11 rounded-full border-2 text-sm font-bold tabular-nums transition-transform active:scale-95 disabled:opacity-30 ${
                        state.bet === n
                          ? 'border-gold bg-gold text-ink'
                          : 'border-card/50 bg-felt text-card'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <Button size="lg" variant="gold" onClick={deal} disabled={busy} className="w-full max-w-xs">
                  Deal
                </Button>
              </div>
            ))}

          {state.phase === 'holding' && (
            <Button size="lg" variant="accent" onClick={draw} disabled={busy} className="w-full max-w-xs">
              Draw
            </Button>
          )}

          <details className="w-full max-w-xs text-card/80">
            <summary className="cursor-pointer text-center text-xs uppercase tracking-widest text-gold/80">
              Paytable
            </summary>
            <div className="mt-2 flex justify-center">
              <Paytable bet={state.bet} highlight={state.result?.category} />
            </div>
          </details>
        </div>
      )}
    </Layout>
  )
}
