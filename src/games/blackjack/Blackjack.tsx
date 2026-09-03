import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Layout } from '../../components/Layout'
import { Button } from '../../components/Button'
import { Loading, ErrorNotice } from '../../components/Loading'
import { useDeck } from '../../hooks/useDeck'
import type { Card as CardData } from '../../types/card'
import { blackjackReducer, initBlackjack, STARTING_BANK } from './blackjackReducer'
import { dealerShouldHit } from './dealerAI'
import { scoreHand } from './handScoring'
import { Hand } from './components/Hand'
import { ChipStack } from './components/ChipStack'
import { BetControls } from './components/BetControls'
import { ResultBanner } from './components/ResultBanner'
import { ScoreSubmit } from '../../components/ScoreSubmit'

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

  // `useDeck` returns a fresh object each render, but its methods are stable.
  const { startNewDeck, drawCards } = deck

  useEffect(() => {
    void startNewDeck()
  }, [startNewDeck])

  const handleDeal = useCallback(async () => {
    setBusy(true)
    try {
      const cards = await drawCards(4)
      // Classic alternating deal: player, dealer, player, dealer.
      dispatch({
        type: 'DEAL',
        playerCards: [cards[0], cards[2]],
        dealerCards: [cards[1], cards[3]],
      })
    } catch {
      /* surfaced via deck.error */
    } finally {
      setBusy(false)
    }
  }, [drawCards])

  const handleHit = useCallback(async () => {
    setBusy(true)
    try {
      const [card] = await drawCards(1)
      dispatch({ type: 'HIT', card })
    } catch {
      /* surfaced via deck.error */
    } finally {
      setBusy(false)
    }
  }, [drawCards])

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
      // Aborted before finishing (e.g. StrictMode remount) — let it run again.
      if (!completed) dealerRunFor.current = -1
    }
  }, [state.phase, state.handId, state.dealerHand, drawCards])

  const restart = useCallback(() => {
    // Abandon a hand in progress and go back to betting with a fresh stack.
    dealerRunFor.current = -1
    setLiveDealer(null)
    dispatch({ type: 'RESET_BANK' })
  }, [])

  const playerScore = scoreHand(state.playerHand).total
  const dealerHand = liveDealer ?? state.dealerHand
  const canAct = state.phase === 'player' && !busy

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
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ChipStack bank={state.bank} bet={state.bet} />
            <p className="text-xs text-card/60">{deck.remaining} cards left</p>
          </div>

          <div className="rounded-2xl border border-gold/30 bg-felt p-4 shadow-xl shadow-black/30 sm:p-6">
            <Hand
              label="Dealer"
              cards={dealerHand}
              holeHidden={state.holeHidden}
              handId={state.handId}
            />
            <div className="my-4 h-px bg-gold/20" />
            <Hand label="You" cards={state.playerHand} handId={state.handId} />
          </div>

          {state.phase === 'settled' && state.result && (
            <ResultBanner result={state.result} payout={state.payout} />
          )}

          {state.phase === 'settled' && peakBank > STARTING_BANK && (
            <ScoreSubmit game="blackjack" score={peakBank} />
          )}

          {state.phase === 'betting' && (
            <>
              {state.bank === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-casino/50 bg-casino/10 p-5 text-center">
                  <p className="text-card">You're out of chips.</p>
                  <Button variant="gold" onClick={() => dispatch({ type: 'RESET_BANK' })}>
                    Reset stack to $100
                  </Button>
                </div>
              ) : (
                <BetControls
                  bank={state.bank}
                  bet={state.bet}
                  onChangeBet={(amount) => dispatch({ type: 'SET_BET', amount })}
                  onDeal={handleDeal}
                  disabled={busy}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Thumb-friendly action bar, pinned to the bottom on mobile. */}
      {(state.phase === 'player' || state.phase === 'dealer') && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-gold/30 bg-felt-deep/95 p-3 backdrop-blur sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0">
          <div className="mx-auto flex max-w-md gap-3">
            <Button
              size="lg"
              variant="accent"
              className="flex-1"
              onClick={handleHit}
              disabled={!canAct}
            >
              Hit
            </Button>
            <Button
              size="lg"
              variant="gold"
              className="flex-1"
              onClick={() => dispatch({ type: 'STAND' })}
              disabled={!canAct}
            >
              Stand {playerScore > 0 ? `(${playerScore})` : ''}
            </Button>
          </div>
        </div>
      )}
    </Layout>
  )
}
