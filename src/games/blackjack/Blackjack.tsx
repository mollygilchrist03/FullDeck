import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Layout } from '../../components/Layout'
import { Button } from '../../components/Button'
import { Loading, ErrorNotice } from '../../components/Loading'
import { useDeck } from '../../hooks/useDeck'
import { ScoreSubmit } from '../../components/ScoreSubmit'
import { GameRules } from '../../components/GameRules'
import { feedback } from '../../lib/feedback'
import type { Card as CardData } from '../../types/card'
import {
  blackjackReducer,
  canDouble,
  canSplit,
  committed,
  initBlackjack,
  STARTING_BANK,
} from './blackjackReducer'
import { dealerShouldHit } from './dealerAI'
import { OUTCOME_MESSAGE } from './outcome'
import { Hand } from './components/Hand'
import { ChipStack } from './components/ChipStack'
import { BetControls } from './components/BetControls'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function Blackjack() {
  const deck = useDeck()
  const [state, dispatch] = useReducer(blackjackReducer, undefined, initBlackjack)
  const [busy, setBusy] = useState(false)
  const [liveDealer, setLiveDealer] = useState<CardData[] | null>(null)
  const [peakBank, setPeakBank] = useState(STARTING_BANK)
  const dealerRunFor = useRef(-1)

  useEffect(() => {
    setPeakBank((p) => Math.max(p, state.bank))
  }, [state.bank])

  useEffect(() => {
    if (state.phase !== 'settled') return
    if (state.netPayout > 0) feedback('win')
    else if (state.netPayout < 0) feedback('lose')
  }, [state.phase, state.netPayout])

  const { startNewDeck, drawCards } = deck

  useEffect(() => {
    void startNewDeck()
  }, [startNewDeck])

  const act = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true)
      try {
        await fn()
      } catch {
        /* surfaced via deck.error */
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const handleDeal = () =>
    act(async () => {
      const c = await drawCards(4)
      feedback('deal')
      dispatch({ type: 'DEAL', playerCards: [c[0], c[2]], dealerCards: [c[1], c[3]] })
    })

  const handleHit = () =>
    act(async () => {
      const [card] = await drawCards(1)
      feedback('flip')
      dispatch({ type: 'HIT', card })
    })

  const handleDouble = () =>
    act(async () => {
      const [card] = await drawCards(1)
      feedback('flip')
      dispatch({ type: 'DOUBLE', card })
    })

  const handleSplit = () =>
    act(async () => {
      const [cardA, cardB] = await drawCards(2)
      feedback('flip')
      dispatch({ type: 'SPLIT', cardA, cardB })
    })

  // Dealer's turn: draw with a beat between cards, then settle. Runs once per hand.
  useEffect(() => {
    if (state.phase !== 'dealer' || dealerRunFor.current === state.handId) return
    dealerRunFor.current = state.handId
    let cancelled = false
    let completed = false

    ;(async () => {
      let dealer = [...state.dealerHand]
      setLiveDealer(dealer)
      while (dealerShouldHit(dealer)) {
        await sleep(650)
        if (cancelled) return
        const [card] = await drawCards(1)
        if (cancelled) return
        feedback('flip')
        dealer = [...dealer, card]
        setLiveDealer(dealer)
      }
      await sleep(500)
      if (cancelled) return
      completed = true
      dispatch({ type: 'DEALER_RESOLVE', dealerHand: dealer })
      setLiveDealer(null)
    })()

    return () => {
      cancelled = true
      if (!completed) dealerRunFor.current = -1
    }
  }, [state.phase, state.handId, state.dealerHand, drawCards])

  const restart = useCallback(() => {
    dealerRunFor.current = -1
    setLiveDealer(null)
    dispatch({ type: 'RESET_BANK' })
  }, [])

  const dealerHand = liveDealer ?? state.dealerHand
  const playing = state.phase === 'player'
  const multi = state.hands.length > 1
  const insuranceCost = Math.floor(state.baseBet / 2)

  const newGameButton =
    state.phase === 'settled' ? (
      <Button variant="gold" onClick={() => dispatch({ type: 'NEW_HAND' })}>
        New hand
      </Button>
    ) : state.phase === 'betting' ? null : (
      <Button variant="ghost" onClick={restart}>
        Restart
      </Button>
    )

  return (
    <Layout title="Blackjack" action={newGameButton}>
      {deck.error && (
        <div className="mb-4">
          <ErrorNotice message={deck.error} onRetry={() => void startNewDeck()} />
        </div>
      )}

      {!deck.deckId && deck.loading ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-5">
          <GameRules>
            <p>Beat the dealer's hand without going over 21. Number cards score their face value, J/Q/K are 10, and an ace is 1 or 11 — whichever helps.</p>
            <p>You and the dealer each get two cards; one dealer card stays face down. <strong>Hit</strong> takes a card, <strong>Stand</strong> stops. <strong>Double</strong> (two-card hands only) doubles your bet for exactly one more card. <strong>Split</strong> a matching pair into two hands, each with its own bet — split aces get one card each, and a two-card 21 after a split is a plain 21, not a blackjack.</p>
            <p>If the dealer shows an ace you're offered <strong>insurance</strong> — a side bet up to half your stake that pays 2:1 if the dealer has blackjack. The dealer then draws to 17 and stands on all 17s.</p>
            <p>Blackjack (ace + a ten-value card in your first two) pays 3:2; other wins pay even money; equal totals push. Not included: surrender, re-splitting aces, dealer hitting soft 17.</p>
          </GameRules>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <ChipStack bank={state.bank} committed={committed(state)} />
            <p className="text-xs text-card/60">{deck.remaining} cards left</p>
          </div>

          <div className="rounded-2xl border border-gold/30 bg-felt p-3 shadow-xl shadow-black/30 sm:p-5">
            <Hand label="Dealer" cards={dealerHand} holeHidden={state.holeHidden} handId={state.handId} />
            <div className="my-3 h-px bg-gold/20" />
            <div className={multi ? 'grid gap-2 sm:grid-cols-2' : ''}>
              {state.hands.map((h, i) => (
                <Hand
                  key={i}
                  label={multi ? `Hand ${i + 1}` : 'You'}
                  cards={h.cards}
                  handId={state.handId}
                  compact={multi}
                  active={playing && i === state.activeHand}
                  muted={state.phase !== 'betting' && h.done && state.phase === 'player'}
                  meta={
                    <>
                      <span className="rounded bg-black/25 px-1.5 py-0.5 text-xs text-card/80">
                        ${h.bet}
                        {h.doubled ? ' ×2' : ''}
                      </span>
                      {h.result && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                            h.payout > 0
                              ? 'bg-gold/20 text-gold'
                              : h.payout < 0
                                ? 'bg-casino/20 text-casino'
                                : 'bg-black/25 text-card/80'
                          }`}
                        >
                          {h.result}
                          {h.payout > 0 ? ` +$${h.payout}` : h.payout < 0 ? ` -$${-h.payout}` : ''}
                        </span>
                      )}
                    </>
                  }
                />
              ))}
            </div>
          </div>

          {/* Insurance */}
          {state.phase === 'insurance' && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-gold/40 bg-black/20 p-4 text-center">
              <p className="text-card">
                Dealer shows an Ace. Take insurance for ${insuranceCost}? Pays 2:1 if the dealer
                has blackjack.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="gold"
                  onClick={() => dispatch({ type: 'TAKE_INSURANCE' })}
                  disabled={insuranceCost < 1 || committed(state) + insuranceCost > state.bank}
                >
                  Insure ${insuranceCost}
                </Button>
                <Button variant="ghost" onClick={() => dispatch({ type: 'DECLINE_INSURANCE' })}>
                  No thanks
                </Button>
              </div>
            </div>
          )}

          {/* Settled summary */}
          {state.phase === 'settled' && (
            <div
              className="animate-deal rounded-xl border border-gold/40 bg-black/20 px-5 py-3 text-center"
              role="status"
              aria-live="polite"
            >
              {state.hands.length === 1 && state.hands[0].result ? (
                <p className="font-display text-xl font-bold text-gold">
                  {OUTCOME_MESSAGE[state.hands[0].result]}
                </p>
              ) : (
                <p className="font-display text-lg font-bold text-gold">
                  {state.hands.map((h) => h.result).join(' · ')}
                </p>
              )}
              {state.insuranceResult && (
                <p className="text-sm text-card/80">Insurance {state.insuranceResult}.</p>
              )}
              <p className="text-sm font-semibold tabular-nums text-card">
                {state.netPayout > 0
                  ? `+$${state.netPayout}`
                  : state.netPayout < 0
                    ? `-$${-state.netPayout}`
                    : 'even'}
              </p>
            </div>
          )}

          {state.phase === 'settled' && (
            <div className="flex justify-center">
              <ScoreSubmit game="blackjack" score={peakBank} />
            </div>
          )}

          {state.phase === 'betting' &&
            (state.bank === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-casino/50 bg-casino/10 p-5 text-center">
                <p className="text-card">You're out of chips.</p>
                <Button variant="gold" onClick={() => dispatch({ type: 'RESET_BANK' })}>
                  Reset stack to ${STARTING_BANK}
                </Button>
              </div>
            ) : (
              <BetControls
                bank={state.bank}
                bet={state.baseBet}
                onChangeBet={(amount) => dispatch({ type: 'SET_BET', amount })}
                onDeal={handleDeal}
                disabled={busy}
              />
            ))}
        </div>
      )}

      {/* Thumb-friendly action bar */}
      {playing && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-gold/30 bg-felt-deep/95 p-3 backdrop-blur sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0">
          <div className="mx-auto grid max-w-md grid-cols-2 gap-2 sm:grid-cols-4">
            <Button size="lg" variant="accent" onClick={handleHit} disabled={busy}>
              Hit
            </Button>
            <Button size="lg" variant="gold" onClick={() => dispatch({ type: 'STAND' })} disabled={busy}>
              Stand
            </Button>
            <Button size="lg" variant="ghost" onClick={handleDouble} disabled={busy || !canDouble(state)}>
              Double
            </Button>
            <Button size="lg" variant="ghost" onClick={handleSplit} disabled={busy || !canSplit(state)}>
              Split
            </Button>
          </div>
        </div>
      )}
    </Layout>
  )
}
