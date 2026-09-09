import { useEffect, useState } from 'react'
import { Button } from '../../components/Button.js'
import { Card } from '../../components/Card.js'
import { ScoreSubmit } from '../../components/ScoreSubmit.js'
import { bestHand, CATEGORY_LABEL } from '../holdem/handRank.js'
import { BIG_BLIND, maxBetTo, potTotal, revealedBoard, toCall, type HoldemState } from '../holdem/holdemReducer.js'
import type { MpBoardProps } from './mpBoards.js'

export function HoldemRoom({ view, send, onNextHand, sending }: MpBoardProps) {
  const s = view.state as HoldemState
  const seat = view.youSeat
  const spectator = seat === null
  const [peakStack, setPeakStack] = useState(0)

  useEffect(() => {
    if (seat === null) return
    setPeakStack((p) => Math.max(p, s.seats[seat].stack))
  }, [seat, s.seats])

  const over = s.phase === 'handover'
  const myTurn = seat !== null && s.toAct === seat
  const call = seat !== null ? toCall(s, seat) : 0
  const pot = potTotal(s)
  const board = revealedBoard(s)
  const matchOver = s.matchWinner != null
  const iWon = seat !== null && s.matchWinner === seat

  const act = (type: 'FOLD' | 'CHECK' | 'CALL') => {
    if (seat !== null) send({ type, seat })
  }
  const raiseTo = (to: number) => {
    if (seat !== null) send({ type: 'BET', seat, to })
  }
  const betTo = (frac: number): number => {
    if (seat === null) return 0
    const raise = Math.max(BIG_BLIND, Math.round((pot + call) * frac))
    return Math.min(maxBetTo(s, seat), s.seats[seat].bet + call + raise)
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex flex-wrap justify-center gap-4">
        {s.seats.map((st, i) => {
          const isYou = i === seat
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <p className="text-xs uppercase tracking-widest text-gold/80">
                {isYou ? 'You' : `Seat ${i + 1}`} — ${st.stack}
                {st.eliminated ? ' · out' : st.folded ? ' · folded' : ''}
              </p>
              <div className="flex gap-1">
                {st.hole.map((c, ci) => (
                  <div key={ci} className="w-12 sm:w-14">
                    <Card card={c} faceDown={!isYou && !(over && !st.folded)} dealt />
                  </div>
                ))}
              </div>
              {over && !st.folded && st.hole.length > 0 && (
                <p className="text-xs text-card/60">{CATEGORY_LABEL[bestHand([...st.hole, ...board]).category]}</p>
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
        {s.log[s.log.length - 1]}
      </p>

      {matchOver && (
        <div className="flex flex-col items-center gap-3">
          <p className="font-display text-xl text-gold">
            {spectator
              ? `Seat ${(s.matchWinner ?? 0) + 1} wins the match.`
              : iWon
                ? 'You win the match!'
                : 'You lost the match.'}
          </p>
          {iWon && <ScoreSubmit game="holdem" score={peakStack} />}
        </div>
      )}

      {!matchOver && over && !spectator && (
        <Button size="lg" variant="gold" disabled={sending} onClick={() => onNextHand?.()}>
          Next hand
        </Button>
      )}

      {myTurn && !over && (
        <div className="flex w-full max-w-md flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="ghost" onClick={() => act('FOLD')} disabled={sending}>
              Fold
            </Button>
            <Button variant="gold" onClick={() => act(call === 0 ? 'CHECK' : 'CALL')} disabled={sending}>
              {call === 0 ? 'Check' : `Call $${call}`}
            </Button>
            {seat !== null && s.seats[seat].stack > 0 && (
              <>
                <Button variant="accent" onClick={() => raiseTo(betTo(0.5))} disabled={sending}>
                  Bet ½ pot
                </Button>
                <Button variant="accent" onClick={() => raiseTo(betTo(1))} disabled={sending}>
                  Bet pot
                </Button>
                <Button variant="accent" onClick={() => raiseTo(maxBetTo(s, seat))} disabled={sending}>
                  All-in
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      {!myTurn && !over && !spectator && <p className="text-xs text-card/50">Waiting on the table…</p>}
      {spectator && !over && <p className="text-xs text-card/50">Spectating.</p>}
    </div>
  )
}
