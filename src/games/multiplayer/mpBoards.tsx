import type { ReactNode } from 'react'
import { ScoreSubmit } from '../../components/ScoreSubmit'
import type { MpGameKey, RoomView } from '../../lib/multiplayer'
import { WarBoard } from '../war/WarBoard'
import type { WarState } from '../war/warReducer'
import { SlapjackRoom } from './SlapjackRoom'
import { OldMaidRoom } from './OldMaidRoom'
import { CrazyEightsRoom } from './CrazyEightsRoom'
import { GoFishRoom } from './GoFishRoom'
import { TrashRoom } from './TrashRoom'

export interface MpBoardProps {
  view: RoomView
  send: (action: unknown) => void
  onRematch: () => void
  /** True while an action of ours is in flight — disable buttons to avoid double-sends. */
  sending: boolean
}

function War({ view, send, sending }: MpBoardProps) {
  const state = view.state as WarState
  const seat = (view.youSeat ?? 0) as 0 | 1
  const spectator = view.youSeat === null
  const mine = seat === 0 ? 'player' : 'dealer'
  const iWon = view.phase === 'done' && state.winner === mine
  const myReady = seat === 0 ? state.readyPlayer : state.readyDealer
  const theirReady = seat === 0 ? state.readyDealer : state.readyPlayer

  return (
    <div className="flex flex-col items-center gap-4">
      <WarBoard
        state={state}
        mySeat={seat}
        onFlip={() => send({ type: 'FLIP', side: mine })}
        flipDisabled={spectator || sending}
        waitingNote={spectator ? 'Spectating.' : undefined}
        ready={{ mine: myReady, theirs: theirReady }}
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
  slapjack: SlapjackRoom,
  'old-maid': OldMaidRoom,
  'crazy-eights': CrazyEightsRoom,
  'go-fish': GoFishRoom,
  trash: TrashRoom,
}

export function MpBoard(props: MpBoardProps): ReactNode {
  const Board = BOARDS[props.view.game] ?? NotReady
  return <Board {...props} />
}
