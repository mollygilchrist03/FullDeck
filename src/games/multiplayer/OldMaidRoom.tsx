import { Card } from '../../components/Card.js'
import { nextLiveSeat, type OldMaidState } from '../oldmaid/oldMaidReducer.js'
import type { MpBoardProps } from './mpBoards.js'

export function OldMaidRoom({ view, send, sending }: MpBoardProps) {
  const s = view.state as OldMaidState
  const seat = view.youSeat
  const spectator = seat === null
  const over = s.phase === 'gameover'
  const myTurn = !spectator && !over && s.turn === seat
  const target = myTurn ? nextLiveSeat(s.hands, seat) : null

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center gap-4">
        {s.hands.map((hand, i) => {
          if (i === seat) return null
          const isTarget = i === target
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <p className="text-xs uppercase tracking-widest text-gold/80">
                Seat {i + 1} — {hand.length} card{hand.length === 1 ? '' : 's'} · {s.discards[i].length} pairs
              </p>
              <div className="flex flex-wrap justify-center">
                {hand.map((_, ci) => (
                  <button
                    key={ci}
                    type="button"
                    disabled={!isTarget || sending}
                    onClick={() => send({ type: 'DRAW', index: ci })}
                    className={`-ml-5 w-10 transition-transform first:ml-0 ${
                      isTarget ? 'hover:-translate-y-2' : ''
                    }`}
                    aria-label={`Take Seat ${i + 1}'s card ${ci + 1}`}
                  >
                    <Card faceDown />
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <p className="min-h-5 max-w-md text-center text-sm text-card/75" role="status" aria-live="polite">
        {over
          ? s.loser === seat
            ? "You're left holding the Old Maid. You lose."
            : `Seat ${(s.loser ?? 0) + 1} is stuck with the Old Maid.`
          : myTurn
            ? 'Your turn — take a card from your neighbor.'
            : s.log[s.log.length - 1]}
      </p>

      <div className="flex flex-col items-center gap-1">
        <p className="text-xs uppercase tracking-widest text-gold/80">
          You — {seat !== null ? s.discards[seat].length : 0} pairs down
        </p>
        <div className="flex flex-wrap justify-center gap-1">
          {(seat !== null ? s.hands[seat] : []).map((c, i) => (
            <div key={`${c.code}-${i}`} className="w-11 sm:w-12">
              <Card card={c} faceDown={false} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
