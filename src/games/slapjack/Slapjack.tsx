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
import { centerTop, initSlapjack, isJack, slapjackReducer } from './slapjackReducer.js'

const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo))

const YOU = 0
const MIN_SEATS = 2
const MAX_SEATS = SEAT_RANGE.slapjack.max

export function Slapjack() {
  const deck = useDeck()
  const [seatCount, setSeatCount] = useState(2)
  const [started, setStarted] = useState(false)
  const [state, dispatch] = useReducer(slapjackReducer, 2, initSlapjack)
  const [dealing, setDealing] = useState(false)
  const [bestMs, setBestMs] = useState<number | null>(null)
  const didInit = useRef(false)
  const slapOpenedAt = useRef<number | null>(null)
  const flipTick = useRef(0)

  const { drawCards } = deck

  const newGame = useCallback(
    async (seats: number) => {
      setDealing(true)
      setBestMs(null)
      try {
        const cards = await drawCards(52)
        feedback('deal')
        // 52 doesn't divide evenly past 4 seats — the first few seats get
        // one extra card each.
        const base = Math.floor(52 / seats)
        const extra = 52 % seats
        const piles: (typeof cards)[] = []
        let at = 0
        for (let i = 0; i < seats; i += 1) {
          const size = base + (i < extra ? 1 : 0)
          piles.push(cards.slice(at, at + size))
          at += size
        }
        dispatch({ type: 'START', piles })
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

  // Whichever AI seat's turn it is flips.
  useEffect(() => {
    if (state.phase !== 'flipping' || state.turn === YOU) return
    flipTick.current += 1
    const id = setTimeout(() => {
      feedback('flip')
      dispatch({ type: 'FLIP' })
    }, rand(500, 950))
    return () => clearTimeout(id)
  }, [state.phase, state.turn, state.center.length])

  // A Jack is showing: open the reaction window and schedule every AI seat's
  // slap attempt independently — first one to actually dispatch wins the
  // race, same as it always has. ~600-1400ms is a real human-beatable
  // reaction; one attempt in five "hesitates" and is a beat or two slower,
  // so an alert player reliably takes those. Someone always slaps
  // eventually, so the game can't stall.
  useEffect(() => {
    if (state.phase !== 'slap') {
      slapOpenedAt.current = null
      return
    }
    slapOpenedAt.current = performance.now()
    const timers = state.piles
      .map((_, seat) => seat)
      .filter((seat) => seat !== YOU)
      .map((seat) => {
        const delay = rand(600, 1400) + (Math.random() < 0.2 ? rand(1400, 3000) : 0)
        return setTimeout(() => {
          feedback('slap')
          dispatch({ type: 'SLAP', who: seat })
        }, delay)
      })
    return () => timers.forEach(clearTimeout)
  }, [state.phase, state.center.length, state.piles])

  useEffect(() => {
    if (state.phase === 'gameover') feedback(state.winner === YOU ? 'win' : 'lose')
  }, [state.phase, state.winner])

  useRecordGameOnce({
    terminal: state.phase === 'gameover',
    game: 'slapjack',
    score: state.winner === YOU && bestMs != null ? bestMs : 0,
    detail:
      state.winner === YOU
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
    dispatch({ type: 'SLAP', who: YOU })
  }

  const over = state.phase === 'gameover'
  const jackUp = state.phase === 'slap' && isJack(centerTop(state))
  const canFlip = state.phase === 'flipping' && state.turn === YOU
  const opponents = state.piles.map((_, i) => i).filter((i) => i !== YOU)

  if (!started) {
    return (
      <Layout title="Slapjack">
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
      title="Slapjack"
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
          <p>The deck is split evenly, face down. Everyone takes turns flipping their top card onto the centre pile.</p>
          <p>When a <strong>Jack</strong> lands, be first to hit <strong>Slap</strong> — the slapper takes the whole centre pile. Slap on anything else and you forfeit a card to the next seat.</p>
          <p>Collect all 52 cards to win. Your fastest winning slap is your score.</p>
        </GameRules>
      </div>

      {dealing ? (
        <Loading label="Splitting the deck…" />
      ) : (
        <div className="flex flex-col items-center gap-5">
          <div className="flex w-full max-w-sm flex-wrap justify-center gap-x-4 gap-y-2 text-center">
            {opponents.map((seat) => (
              <div key={seat}>
                <p className="text-xs uppercase tracking-widest text-gold/80">
                  {opponents.length > 1 ? `Seat ${seat + 1}` : 'Dealer'}
                </p>
                <p className="text-2xl font-bold tabular-nums text-card">{state.piles[seat].length}</p>
              </div>
            ))}
            <div>
              <p className="text-xs uppercase tracking-widest text-gold/80">Centre</p>
              <p className="text-2xl font-bold tabular-nums text-card">{state.center.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-gold/80">You</p>
              <p className="text-2xl font-bold tabular-nums text-card">{state.piles[YOU].length}</p>
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
                {state.winner === YOU
                  ? 'You hold every card — you win!'
                  : opponents.length > 1
                    ? `Seat ${state.winner! + 1} swept the deck. You lose.`
                    : 'The dealer swept the deck. You lose.'}
              </p>
              {state.winner === YOU && bestMs != null && (
                <ScoreSubmit game="slapjack" score={bestMs} />
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
