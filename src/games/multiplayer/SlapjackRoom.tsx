import { Button } from '../../components/Button.js'
import { Card } from '../../components/Card.js'
import { centerTop, isJack, type SlapjackState } from '../slapjack/slapjackReducer.js'
import type { MpBoardProps } from './mpBoards.js'

export function SlapjackRoom({ view, send, sending }: MpBoardProps) {
  const s = view.state as SlapjackState
  const seat = view.youSeat
  const spectator = seat === null
  const over = s.phase === 'gameover'
  const jackUp = s.phase === 'slap' && isJack(centerTop(s))
  const canFlip = seat !== null && s.phase === 'flipping' && s.turn === seat

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex w-full max-w-md flex-wrap justify-center gap-4 text-center">
        {s.piles.map((pile, i) => (
          <div key={i}>
            <p className="text-xs uppercase tracking-widest text-gold/80">{i === seat ? 'You' : `Seat ${i + 1}`}</p>
            <p className="text-2xl font-bold tabular-nums text-card">{pile.length}</p>
          </div>
        ))}
        <div>
          <p className="text-xs uppercase tracking-widest text-gold/80">Centre</p>
          <p className="text-2xl font-bold tabular-nums text-card">{s.center.length}</p>
        </div>
      </div>

      <div
        className={`w-24 rounded-[0.6rem] transition-shadow sm:w-28 ${
          jackUp ? 'shadow-[0_0_0_6px_rgba(230,57,70,0.6)]' : ''
        }`}
      >
        {centerTop(s) ? (
          <Card card={centerTop(s)} faceDown={false} dealt />
        ) : (
          <div className="aspect-[5/7] w-full rounded-[0.55rem] border border-dashed border-card/25" />
        )}
      </div>

      <p className="min-h-5 text-center text-sm text-card/75" role="status" aria-live="polite">
        {over
          ? s.winner === seat
            ? 'You hold every card — you win!'
            : `Seat ${(s.winner ?? 0) + 1} swept the deck.`
          : s.log[s.log.length - 1]}
      </p>

      {!over && (
        <div className="flex w-full max-w-sm gap-3">
          <Button
            size="lg"
            variant="ghost"
            className="flex-1"
            onClick={() => send({ type: 'FLIP' })}
            disabled={!canFlip || sending}
          >
            Flip
          </Button>
          <Button
            size="lg"
            variant="accent"
            className="flex-1"
            onClick={() => seat !== null && send({ type: 'SLAP', who: seat })}
            disabled={spectator || sending}
          >
            Slap!
          </Button>
        </div>
      )}

      {over && !spectator && (
        <p className="text-xs text-card/60">
          Play Slapjack from the hub to post a reaction time to the leaderboard.
        </p>
      )}
    </div>
  )
}
