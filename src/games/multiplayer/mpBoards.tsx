import type { ReactNode } from 'react'
import { ScoreSubmit } from '../../components/ScoreSubmit'
import type { MpGameKey, RoomView } from '../../lib/multiplayer'
import { WarBoard } from '../war/WarBoard'
import type { WarState } from '../war/warReducer'

export interface MpBoardProps {
  view: RoomView
  send: (action: unknown) => void
  onRematch: () => void
}

function War({ view, send }: MpBoardProps) {
  const state = view.state as WarState
  const seat = (view.youSeat ?? 0) as 0 | 1
  const spectator = view.youSeat === null
  const mine = seat === 0 ? 'player' : 'dealer'
  const iWon = view.phase === 'done' && state.winner === mine

  return (
    <div className="flex flex-col items-center gap-4">
      <WarBoard
        state={state}
        mySeat={seat}
        onFlip={() => send({ type: 'FLIP' })}
        flipDisabled={spectator}
        waitingNote={spectator ? 'Spectating.' : undefined}
      />
      {view.phase === 'done' && !spectator && iWon && (
        <ScoreSubmit game="war" score={state.battles} />
      )}
    </div>
  )
}

function NotReady({ view }: MpBoardProps) {
  return (
    <p className="mx-auto max-w-sm text-center text-sm text-card/70">
      {view.game} isn&apos;t playable in a room yet — it&apos;s next on the list.
    </p>
  )
}

const BOARDS: Partial<Record<MpGameKey, (p: MpBoardProps) => ReactNode>> = {
  war: War,
}

export function MpBoard(props: MpBoardProps): ReactNode {
  const Board = BOARDS[props.view.game] ?? NotReady
  return <Board {...props} />
}
