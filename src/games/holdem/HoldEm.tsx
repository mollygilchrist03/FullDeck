import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Layout } from '../../components/Layout'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Loading, ErrorNotice } from '../../components/Loading'
import { useDeck } from '../../hooks/useDeck'
import { ScoreSubmit } from '../../components/ScoreSubmit'
import { GameRules } from '../../components/GameRules'
import { feedback } from '../../lib/feedback'
import type { Card as CardData } from '../../types/card'
import { CATEGORY_LABEL } from './handRank'
import { chooseAiAction } from './holdemLogic'
import {
  BIG_BLIND,
  holdemReducer,
  initHoldem,
  maxBetTo,
  revealedBoard,
  toCall,
} from './holdemReducer'

const AI_THINK_MS = 950

function splitDeal(cards: CardData[]) {
  return {
    playerHole: [cards[0], cards[1]] as [CardData, CardData],
    aiHole: [cards[2], cards[3]] as [CardData, CardData],
    board: cards.slice(4, 9),
  }
}

export function HoldEm() {
  const deck = useDeck()
  const [state, dispatch] = useReducer(holdemReducer, undefined, initHoldem)
  const [dealing, setDealing] = useState(true)
  const [peakStack, setPeakStack] = useState(200)
  const didInit = useRef(false)

  const { reshuffleAndDraw } = deck

  const dealNext = useCallback(
    async (kind: 'START' | 'NEW_HAND') => {
      setDealing(true)
      try {
        const cards = await reshuffleAndDraw(9)
        feedback('deal')
        dispatch({ type: kind, ...splitDeal(cards) })
      } catch {
        /* surfaced via deck.error */
      } finally {
        setDealing(false)
      }
    },
    [reshuffleAndDraw],
  )

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    void dealNext('START')
  }, [dealNext])

  useEffect(() => {
    setPeakStack((p) => Math.max(p, state.playerStack))
  }, [state.playerStack])

  useEffect(() => {
    if (state.phase === 'handover') {
      feedback(state.winner === 'player' ? 'win' : state.winner === 'split' ? 'flip' : 'lose')
    }
  }, [state.phase, state.winner])

  // Drive the AI's turn.
  useEffect(() => {
    if (state.toAct !== 'ai') return
    const t = setTimeout(() => {
      const decision = chooseAiAction(state)
      feedback('flip')
      if (decision.type === 'BET') dispatch({ type: 'BET', side: 'ai', to: decision.to })
      else dispatch({ type: decision.type, side: 'ai' })
    }, AI_THINK_MS)
    return () => clearTimeout(t)
  }, [state])

  const over = state.phase === 'handover'
  const myTurn = state.toAct === 'player'
  const call = toCall(state, 'player')
  const pot = state.pot + state.playerBet + state.aiBet
  const board = revealedBoard(state)

  const betTo = (frac: number) => {
    const potAfterCall = pot + call
    const raise = Math.max(BIG_BLIND, Math.round(potAfterCall * frac))
    return Math.min(maxBetTo(state, 'player'), state.playerBet + call + raise)
  }

  const act = (type: 'FOLD' | 'CHECK' | 'CALL') => {
    feedback('flip')
    dispatch({ type, side: 'player' })
  }
  const raiseTo = (to: number) => {
    feedback('flip')
    dispatch({ type: 'BET', side: 'player', to })
  }

  return (
    <Layout
      title="Texas Hold'em"
      action={
        state.matchWinner ? (
          <Button variant="gold" onClick={() => void dealNext('START')} disabled={dealing}>
            New match
          </Button>
        ) : null
      }
    >
      {deck.error && (
        <div className="mb-4">
          <ErrorNotice message={deck.error} onRetry={() => void dealNext('START')} />
        </div>
      )}

      <div className="mb-4">
        <GameRules>
          <p>Heads-up, No-Limit — just you and the house across the felt. Each hand you're dealt two hole cards; five community cards come out in stages (flop, turn, river) that either of you can bet, call, raise, or fold around.</p>
          <p>Best five-card hand from your two plus the board wins the pot at showdown. Small blind acts first before the flop and last on every street after — the house's dealer button rotates every hand.</p>
          <p>Blinds are fixed at {BIG_BLIND / 2}/{BIG_BLIND}. Shove more than your opponent can match and the uncalled excess comes right back to you. Bust your stack and the match is over — your peak stack is your score.</p>
        </GameRules>
      </div>

      {dealing ? (
        <Loading label="Shuffling…" />
      ) : (
        <div className="flex flex-col items-center gap-5">
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs uppercase tracking-widest text-gold/80">
              House — ${state.aiStack}
              {state.aiFolded ? ' · folded' : ''}
            </p>
            <div className="flex gap-1">
              {state.aiHole.map((c, i) => (
                <div key={i} className="w-14 sm:w-16">
                  <Card card={c} faceDown={!over} dealt />
                </div>
              ))}
            </div>
            {over && state.aiRank && !state.aiFolded && (
              <p className="text-xs text-card/60">{CATEGORY_LABEL[state.aiRank.category]}</p>
            )}
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
              {state.playerHole.map((c, i) => (
                <div key={i} className="w-14 sm:w-16">
                  <Card card={c} faceDown={false} dealt />
                </div>
              ))}
            </div>
            <p className="text-xs uppercase tracking-widest text-gold/80">
              You — ${state.playerStack}
              {state.playerFolded ? ' · folded' : ''}
              {over && state.playerRank && !state.playerFolded ? ` · ${CATEGORY_LABEL[state.playerRank.category]}` : ''}
            </p>
          </div>

          {over && (
            <div className="flex flex-col items-center gap-3">
              <p className="font-display text-xl text-gold">
                {state.matchWinner
                  ? state.matchWinner === 'player'
                    ? 'You win the match!'
                    : 'The house wins the match.'
                  : state.winner === 'split'
                    ? `Split pot — ${state.winAmount} each.`
                    : state.winner === 'player'
                      ? `You win ${state.winAmount}.`
                      : `The house wins ${state.winAmount}.`}
              </p>
              {state.matchWinner === 'player' && <ScoreSubmit game="holdem" score={peakStack} />}
              {!state.matchWinner && (
                <Button size="lg" variant="gold" onClick={() => void dealNext('NEW_HAND')} disabled={dealing}>
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
                {state.playerStack > 0 && (
                  <>
                    <Button variant="accent" onClick={() => raiseTo(betTo(0.5))}>
                      Bet ½ pot
                    </Button>
                    <Button variant="accent" onClick={() => raiseTo(betTo(1))}>
                      Bet pot
                    </Button>
                    <Button variant="accent" onClick={() => raiseTo(maxBetTo(state, 'player'))}>
                      All-in
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
          {!myTurn && !over && <p className="text-xs text-card/50">The house is thinking…</p>}
        </div>
      )}
    </Layout>
  )
}
