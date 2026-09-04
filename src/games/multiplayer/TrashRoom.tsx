import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import type { Slot, TrashState } from '../trash/trashReducer'
import type { MpBoardProps } from './mpBoards'

function Row({
  slots,
  label,
  onPick,
}: {
  slots: Slot[]
  label: string
  onPick?: (i: number) => void
}) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-widest text-gold/80">{label}</p>
      <div className="flex flex-wrap gap-x-1 gap-y-4 pt-1">
        {slots.map((s, i) => (
          <div key={i} className="relative w-9 sm:w-12">
            <span className="absolute -top-3.5 left-0 right-0 text-center text-[0.6rem] text-card/40">
              {i + 1}
            </span>
            <Card
              card={s.locked ?? { code: 'x', image: '', rank: 'ACE', suit: 'SPADES' }}
              faceDown={!s.locked}
              onClick={onPick && !s.locked ? () => onPick(i) : undefined}
              disabled={!onPick || !!s.locked}
              className={onPick && !s.locked ? 'ring-2 ring-gold' : ''}
              label={s.locked ? undefined : `Slot ${i + 1}`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function TrashRoom({ view, send }: MpBoardProps) {
  const s = view.state as TrashState
  const seat = view.youSeat ?? 0
  const spectator = view.youSeat === null
  const side = seat === 0 ? 'player' : 'ai'
  const mySlots = side === 'player' ? s.playerSlots : s.aiSlots
  const theirSlots = side === 'player' ? s.aiSlots : s.playerSlots
  const mySize = side === 'player' ? s.playerSize : s.aiSize
  const theirSize = side === 'player' ? s.aiSize : s.playerSize
  const over = s.phase === 'gameover'
  const myTurn = !spectator && !over && s.turn === side && s.phase === (side === 'player' ? 'playerTurn' : 'aiTurn')
  const myWild = !spectator && s.phase === 'wildChoice' && s.turn === side
  const discardTop = s.discard[s.discard.length - 1]

  return (
    <div className="flex flex-col items-center gap-4">
      <Row slots={theirSlots} label={`Opponent — lays ${theirSize}`} />

      <div className="flex items-end gap-4">
        <div className="flex flex-col items-center gap-1">
          <div className="w-14 sm:w-16">
            <Card faceDown />
          </div>
          <span className="text-[0.7rem] text-card/60">stock {s.stock.length}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-14 sm:w-16">
            {discardTop ? (
              <Card card={discardTop} faceDown={false} />
            ) : (
              <div className="aspect-[5/7] w-full rounded-[0.55rem] border border-dashed border-card/25" />
            )}
          </div>
          <span className="text-[0.7rem] text-card/60">discard</span>
        </div>
        {s.held && (
          <div className="flex flex-col items-center gap-1">
            <div className="w-14 animate-deal sm:w-16">
              <Card card={s.held} faceDown={false} />
            </div>
            <span className="text-[0.7rem] text-gold">in hand</span>
          </div>
        )}
      </div>

      <Row
        slots={mySlots}
        label={`You — lay ${mySize}`}
        onPick={myWild ? (i) => send({ type: 'PLACE_WILD', slot: i, side }) : undefined}
      />

      <p className="min-h-5 max-w-md text-center text-sm text-card/75" role="status" aria-live="polite">
        {over
          ? s.matchWinner === side
            ? 'You cleared your row — you win!'
            : 'Your opponent cleared their row. You lose.'
          : myWild
            ? 'Queen is wild — tap an open slot.'
            : myTurn
              ? 'Your turn.'
              : s.log[s.log.length - 1]}
      </p>

      {myTurn && (
        <div className="flex gap-3">
          <Button size="lg" variant="accent" onClick={() => send({ type: 'DRAW', side })}>
            Draw
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={() => send({ type: 'TAKE_DISCARD', side })}
            disabled={!discardTop}
          >
            Take discard
          </Button>
        </div>
      )}
    </div>
  )
}
