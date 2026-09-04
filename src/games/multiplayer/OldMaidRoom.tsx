import { Card } from '../../components/Card'
import type { OldMaidState } from '../oldmaid/oldMaidReducer'
import type { MpBoardProps } from './mpBoards'

export function OldMaidRoom({ view, send }: MpBoardProps) {
  const s = view.state as OldMaidState
  const seat = view.youSeat ?? 0
  const spectator = view.youSeat === null
  const myRole = seat === 0 ? 'player' : 'ai'
  const myHand = seat === 0 ? s.playerHand : s.aiHand
  const theirHand = seat === 0 ? s.aiHand : s.playerHand
  const myPairs = seat === 0 ? s.playerDiscards : s.aiDiscards
  const theirPairs = seat === 0 ? s.aiDiscards : s.playerDiscards
  const over = s.phase === 'gameover'
  const myTurn = !spectator && !over && s.turn === myRole

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <p className="text-xs uppercase tracking-widest text-gold/80">
          Opponent — {theirHand.length} cards · {theirPairs.length} pairs
        </p>
        <div className="flex flex-wrap justify-center">
          {theirHand.map((_, i) => (
            <button
              key={i}
              type="button"
              disabled={!myTurn}
              onClick={() => send({ type: 'DRAW', index: i })}
              className={`-ml-5 w-10 transition-transform first:ml-0 ${
                myTurn ? 'hover:-translate-y-2' : ''
              }`}
              aria-label={`Take opponent's card ${i + 1}`}
            >
              <Card faceDown />
            </button>
          ))}
        </div>
      </div>

      <p className="min-h-5 max-w-md text-center text-sm text-card/75" role="status" aria-live="polite">
        {over
          ? s.winner === myRole
            ? 'Your opponent is the Old Maid — you win!'
            : "You're left holding the Old Maid. You lose."
          : myTurn
            ? 'Your turn — take a card from your opponent.'
            : s.log[s.log.length - 1]}
      </p>

      <div className="flex flex-col items-center gap-1">
        <p className="text-xs uppercase tracking-widest text-gold/80">
          You — {myPairs.length} pairs down
        </p>
        <div className="flex flex-wrap justify-center gap-1">
          {myHand.map((c, i) => (
            <div key={`${c.code}-${i}`} className="w-11 sm:w-12">
              <Card card={c} faceDown={false} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
