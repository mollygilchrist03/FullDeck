import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { centerTop, isJack, type SlapjackState } from '../slapjack/slapjackReducer'
import type { MpBoardProps } from './mpBoards'

export function SlapjackRoom({ view, send }: MpBoardProps) {
  const s = view.state as SlapjackState
  const seat = view.youSeat ?? 0
  const spectator = view.youSeat === null
  const myRole = seat === 0 ? 'player' : 'ai'
  const myPile = seat === 0 ? s.playerPile : s.aiPile
  const theirPile = seat === 0 ? s.aiPile : s.playerPile
  const over = s.phase === 'gameover'
  const jackUp = s.phase === 'slap' && isJack(centerTop(s))
  const canFlip = !spectator && s.phase === 'flipping' && s.turn === myRole

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex w-full max-w-sm justify-between text-center">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold/80">Opponent</p>
          <p className="text-2xl font-bold tabular-nums text-card">{theirPile.length}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-gold/80">Centre</p>
          <p className="text-2xl font-bold tabular-nums text-card">{s.center.length}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-gold/80">You</p>
          <p className="text-2xl font-bold tabular-nums text-card">{myPile.length}</p>
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
          ? s.winner === myRole
            ? 'You hold every card — you win!'
            : 'Your opponent swept the deck. You lose.'
          : s.log[s.log.length - 1]}
      </p>

      {!over && (
        <div className="flex w-full max-w-sm gap-3">
          <Button
            size="lg"
            variant="ghost"
            className="flex-1"
            onClick={() => send({ type: 'FLIP' })}
            disabled={!canFlip}
          >
            Flip
          </Button>
          <Button
            size="lg"
            variant="accent"
            className="flex-1"
            onClick={() => send({ type: 'SLAP', who: myRole })}
            disabled={spectator}
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
