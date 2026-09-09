import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Layout } from '../../components/Layout.js'
import { Button } from '../../components/Button.js'
import { Card } from '../../components/Card.js'
import { Loading, ErrorNotice } from '../../components/Loading.js'
import { useDeck } from '../../hooks/useDeck.js'
import { ScoreSubmit } from '../../components/ScoreSubmit.js'
import { GameRules } from '../../components/GameRules.js'
import { feedback } from '../../lib/feedback.js'
import { useRecordGameOnce } from '../../hooks/useRecordGame.js'
import type { Card as CardData } from '../../types/card.js'
import { bestHand, CATEGORY_LABEL, type HandCategory } from './handRank.js'
import { chooseAiAction } from './holdemLogic.js'
import {
  BIG_BLIND,
  holdemReducer,
  initHoldem,
  maxBetTo,
  potTotal,
  revealedBoard,
  toCall,
} from './holdemReducer.js'

const AI_THINK_MS = 950
const MIN_SEATS = 2
const MAX_SEATS = 6
const YOU = 0

function splitDeal(cards: CardData[], seatCount: number) {
  const holes: [CardData, CardData][] = []
  for (let i = 0; i < seatCount; i += 1) holes.push([cards[i * 2], cards[i * 2 + 1]])
  return { holes, board: cards.slice(seatCount * 2, seatCount * 2 + 5) }
}

export function HoldEm() {
  const deck = useDeck()
  const [tableSize, setTableSize] = useState(MAX_SEATS)
  const [started, setStarted] = useState(false)
  const [state, dispatch] = useReducer(holdemReducer, tableSize, initHoldem)
  const [dealing, setDealing] = useState(false)
  const [peakStack, setPeakStack] = useState(200)
  const didInit = useRef(false)

  const { reshuffleAndDraw } = deck

  const dealNext = useCallback(
    async (kind: 'START' | 'NEW_HAND', seatCount: number) => {
      setDealing(true)
      try {
        const cards = await reshuffleAndDraw(seatCount * 2 + 5)
        feedback('deal')
        const { holes, board } = splitDeal(cards, seatCount)
        if (kind === 'START') dispatch({ type: 'START', seatCount, holes, board })
        else dispatch({ type: 'NEW_HAND', holes, board })
      } catch {
        /* surfaced via deck.error */
      } finally {
        setDealing(false)
      }
    },
    [reshuffleAndDraw],
  )

  useEffect(() => {
    if (!started || didInit.current) return
    didInit.current = true
    void dealNext('START', tableSize)
  }, [started, dealNext, tableSize])

  useEffect(() => {
    setPeakStack((p) => Math.max(p, state.seats[YOU].stack))
  }, [state.seats])

  useRecordGameOnce({
    terminal: state.matchWinner != null,
    game: 'holdem',
    score: peakStack,
    detail: state.matchWinner === YOU ? `Won the match — peak stack $${peakStack}` : 'Lost the match',
  })

  useEffect(() => {
    if (state.phase === 'handover' && state.potResults.length > 0) {
      const won = state.potResults.some((r) => r.winners.includes(YOU))
      const lost = state.potResults.some((r) => !r.winners.includes(YOU) && r.winners.length > 0)
      feedback(won && !lost ? 'win' : won ? 'flip' : 'lose')
    }
  }, [state.phase, state.potResults])

  // Drive whichever AI seat's turn it is (every seat but yours, in solo play).
  useEffect(() => {
    if (state.toAct === null || state.toAct === YOU) return
    const seat = state.toAct
    const t = setTimeout(() => {
      const decision = chooseAiAction(state, seat)
      feedback('flip')
      if (decision.type === 'BET') dispatch({ type: 'BET', seat, to: decision.to })
      else dispatch({ type: decision.type, seat })
    }, AI_THINK_MS)
    return () => clearTimeout(t)
  }, [state])

  const over = state.phase === 'handover'
  const myTurn = state.toAct === YOU
  const call = toCall(state, YOU)
  const pot = potTotal(state)
  const board = revealedBoard(state)
  const opponents = state.seats.map((_, i) => i).filter((i) => i !== YOU)

  const betTo = (frac: number) => {
    const potAfterCall = pot + call
    const raise = Math.max(BIG_BLIND, Math.round(potAfterCall * frac))
    return Math.min(maxBetTo(state, YOU), state.seats[YOU].bet + call + raise)
  }

  const act = (type: 'FOLD' | 'CHECK' | 'CALL') => {
    feedback('flip')
    dispatch({ type, seat: YOU })
  }
  const raiseTo = (to: number) => {
    feedback('flip')
    dispatch({ type: 'BET', seat: YOU, to })
  }

  if (!started) {
    return (
      <Layout title="Texas Hold'em">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-4 text-center">
          <p className="text-card/80">How many at the table? You against up to five AI opponents.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: MAX_SEATS - MIN_SEATS + 1 }, (_, i) => MIN_SEATS + i).map((n) => (
              <Button
                key={n}
                variant={n === tableSize ? 'gold' : 'ghost'}
                onClick={() => setTableSize(n)}
              >
                {n}
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
      title="Texas Hold'em"
      action={
        state.matchWinner != null ? (
          <Button variant="gold" onClick={() => void dealNext('START', tableSize)} disabled={dealing}>
            New match
          </Button>
        ) : null
      }
    >
      {deck.error && (
        <div className="mb-4">
          <ErrorNotice message={deck.error} onRetry={() => void dealNext('START', tableSize)} />
        </div>
      )}

      <div className="mb-4">
        <GameRules>
          <p>No-Limit, {state.seats.length}-handed — you against up to five AI opponents. Each hand you're dealt two hole cards; five community cards come out in stages (flop, turn, river) that anyone still in can bet, call, raise, or fold around.</p>
          <p>Best five-card hand from your two plus the board wins at showdown. If an all-in leaves players contesting different amounts, the pot splits into side pots — each layer goes only to whoever put in enough to reach it. The button rotates every hand and blinds are fixed at {BIG_BLIND / 2}/{BIG_BLIND}.</p>
          <p>Shove more than the table can match and the uncalled excess comes right back to you. Bust your stack and you're out — outlast the table and the match is over. Your peak stack is your score.</p>
        </GameRules>
      </div>

      {dealing ? (
        <Loading label="Shuffling…" />
      ) : (
        <div className="flex flex-col items-center gap-5">
          <div className="flex flex-wrap justify-center gap-4">
            {opponents.map((seat) => {
              const s = state.seats[seat]
              return (
                <div key={seat} className="flex flex-col items-center gap-1">
                  <p className="text-xs uppercase tracking-widest text-gold/80">
                    Seat {seat + 1} — ${s.stack}
                    {s.eliminated ? ' · out' : s.folded ? ' · folded' : ''}
                  </p>
                  <div className="flex gap-1">
                    {s.hole.map((c, i) => (
                      <div key={i} className="w-14 sm:w-16">
                        <Card card={c} faceDown={!over || s.folded} dealt />
                      </div>
                    ))}
                  </div>
                  {over && !s.folded && s.hole.length > 0 && (
                    <p className="text-xs text-card/60">
                      {CATEGORY_LABEL[bestHandCategory(s.hole, board)]}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex flex-col items-center gap-2">
            <p className="text-xs uppercase tracking-widest text-gold/80">Pot: ${pot}</p>
            <div className="flex gap-1">
              {board.map((c, i) => (
                <div key={i} className="w-12 sm:w-14">
                  <Card card={c} faceDown={false} dealt />
                </div>
              ))}
              {Array.from({ length: 5 - board.length }).map((_, i) => (
                <div key={`x${i}`} className="w-12 sm:w-14">
                  <div className="aspect-[5/7] w-full rounded-[0.55rem] border border-dashed border-card/20" />
                </div>
              ))}
            </div>
          </div>

          <p className="min-h-5 max-w-md text-center text-sm text-card/75" role="status" aria-live="polite">
            {state.log[state.log.length - 1]}
          </p>

          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-1">
              {state.seats[YOU].hole.map((c, i) => (
                <div key={i} className="w-14 sm:w-16">
                  <Card card={c} faceDown={false} dealt />
                </div>
              ))}
            </div>
            <p className="text-xs uppercase tracking-widest text-gold/80">
              You — ${state.seats[YOU].stack}
              {state.seats[YOU].folded ? ' · folded' : ''}
              {over && !state.seats[YOU].folded && state.seats[YOU].hole.length > 0
                ? ` · ${CATEGORY_LABEL[bestHandCategory(state.seats[YOU].hole, board)]}`
                : ''}
            </p>
          </div>

          {over && (
            <div className="flex flex-col items-center gap-3">
              <p className="font-display text-xl text-gold">
                {state.matchWinner != null
                  ? state.matchWinner === YOU
                    ? 'You win the match!'
                    : 'The table wins the match.'
                  : state.potResults.some((r) => r.winners.includes(YOU))
                    ? 'You win the pot.'
                    : 'You lose the pot.'}
              </p>
              {state.matchWinner === YOU && <ScoreSubmit game="holdem" score={peakStack} />}
              {state.matchWinner == null && (
                <Button size="lg" variant="gold" onClick={() => void dealNext('NEW_HAND', state.seats.length)} disabled={dealing}>
                  Next hand
                </Button>
              )}
            </div>
          )}

          {myTurn && !over && (
            <div className="flex w-full max-w-md flex-col items-center gap-2">
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="ghost" onClick={() => act('FOLD')}>
                  Fold
                </Button>
                <Button variant="gold" onClick={() => act(call === 0 ? 'CHECK' : 'CALL')}>
                  {call === 0 ? 'Check' : `Call $${call}`}
                </Button>
                {state.seats[YOU].stack > 0 && (
                  <>
                    <Button variant="accent" onClick={() => raiseTo(betTo(0.5))}>
                      Bet ½ pot
                    </Button>
                    <Button variant="accent" onClick={() => raiseTo(betTo(1))}>
                      Bet pot
                    </Button>
                    <Button variant="accent" onClick={() => raiseTo(maxBetTo(state, YOU))}>
                      All-in
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
          {!myTurn && !over && <p className="text-xs text-card/50">Waiting on the table…</p>}
        </div>
      )}
    </Layout>
  )
}

function bestHandCategory(hole: CardData[], board: CardData[]): HandCategory {
  return bestHand([...hole, ...board]).category
}
