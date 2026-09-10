import { Button } from '../../components/Button.js'
import { Card } from '../../components/Card.js'
import type { Slot, TrashState } from '../trash/trashReducer.js'
import type { MpBoardProps } from './mpBoards.js'

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

export function TrashRoom({ view, send, sending }: MpBoardProps) {
  const s = view.state as TrashState
  const seat = view.youSeat
  const spectator = seat === null
  const over = s.phase === 'gameover'
  const myTurn = !spectator && !over && s.phase === 'turn' && s.turn === seat
  const myWild = !spectator && s.phase === 'wildChoice' && s.turn === seat
  const discardTop = s.discard[s.discard.length - 1]

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center gap-4">
        {s.slots.map((row, i) => {
          if (i === seat) return null
          return <Row key={i} slots={row} label={`Seat ${i + 1} — lays ${s.sizes[i]}`} />
        })}
      </div>

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

      {seat !== null && (
        <Row
          slots={s.slots[seat]}
          label={`You — lay ${s.sizes[seat]}`}
          onPick={myWild && !sending ? (i) => send({ type: 'PLACE_WILD', slot: i, seat }) : undefined}
        />
      )}

      <p className="min-h-5 max-w-md text-center text-sm text-card/75" role="status" aria-live="polite">
        {over
          ? s.matchWinner === seat
            ? 'You cleared your row — you win!'
            : `Seat ${(s.matchWinner ?? 0) + 1} cleared their row.`
          : myWild
            ? 'Queen is wild — tap an open slot.'
            : myTurn
              ? 'Your turn.'
              : s.log[s.log.length - 1]}
      </p>

      {myTurn && (
        <div className="flex gap-3">
          <Button
            size="lg"
            variant="accent"
            onClick={() => send({ type: 'DRAW', seat })}
            disabled={sending}
          >
            Draw
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={() => send({ type: 'TAKE_DISCARD', seat })}
            disabled={!discardTop || sending}
          >
            Take discard
          </Button>
        </div>
      )}
    </div>
  )
}
