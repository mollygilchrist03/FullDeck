import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import type { Rank } from '../../types/card'
import { ranksIn } from '../gofish/goFishLogic'
import type { GoFishState } from '../gofish/goFishReducer'
import type { MpBoardProps } from './mpBoards'

const RANK_SHORT: Record<Rank, string> = {
  ACE: 'A',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  JACK: 'J',
  QUEEN: 'Q',
  KING: 'K',
}
const ORDER = Object.keys(RANK_SHORT)

export function GoFishRoom({ view, send, sending }: MpBoardProps) {
  const s = view.state as GoFishState
  const seat = view.youSeat ?? 0
  const spectator = view.youSeat === null
  const side = seat === 0 ? 'player' : 'ai'
  const myHand = side === 'player' ? s.playerHand : s.aiHand
  const theirHand = side === 'player' ? s.aiHand : s.playerHand
  const myBooks = side === 'player' ? s.playerBooks : s.aiBooks
  const theirBooks = side === 'player' ? s.aiBooks : s.playerBooks
  const myAsk = side === 'player' ? 'playerAsk' : 'aiAsk'
  const myDraw = side === 'player' ? 'playerDraw' : 'aiDraw'
  const over = s.phase === 'gameover'
  const canAsk = !spectator && s.phase === myAsk
  const canDraw = !spectator && s.phase === myDraw
  const myRanks = ranksIn(myHand).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <p className="text-xs uppercase tracking-widest text-gold/80">
          Opponent — {theirHand.length} cards · {theirBooks.length} books
        </p>
        <div className="flex">
          {theirHand.slice(0, 14).map((_, i) => (
            <div key={i} className="-ml-6 w-9 first:ml-0">
              <Card faceDown />
            </div>
          ))}
        </div>
      </div>

      <div className="flex w-full max-w-md justify-around text-center text-sm">
        <span className="text-card/70">Their books: {theirBooks.length}</span>
        <span className="text-card/70">Your books: {myBooks.length}</span>
      </div>

      <button
        type="button"
        onClick={() => send({ type: 'DRAW', side })}
        disabled={!canDraw || sending}
        className="flex flex-col items-center gap-1 disabled:opacity-60"
        aria-label="Fish from the stock"
      >
        <div className={`w-16 ${canDraw ? 'animate-pulse-match' : ''}`}>
          <Card faceDown />
        </div>
        <span className="text-xs text-card/70">stock {s.stock.length}</span>
      </button>

      <p className="min-h-5 max-w-md text-center text-sm text-card/75" role="status" aria-live="polite">
        {over
          ? s.winner === side
            ? `You win ${myBooks.length}–${theirBooks.length}!`
            : `Your opponent wins ${theirBooks.length}–${myBooks.length}.`
          : canAsk
            ? 'Your turn — ask for a rank you hold.'
            : canDraw
              ? 'Go fish — tap the stock to draw.'
              : s.log[s.log.length - 1]}
      </p>

      <div className="flex flex-wrap justify-center gap-1">
        {myHand.map((c, i) => (
          <div key={`${c.code}-${i}`} className="w-12 sm:w-14">
            <Card card={c} faceDown={false} />
          </div>
        ))}
      </div>

      {canAsk && (
        <div className="flex flex-wrap justify-center gap-2">
          {myRanks.map((r) => (
            <Button
              key={r}
              variant="gold"
              onClick={() => send({ type: 'ASK', rank: r, side })}
              disabled={sending}
            >
              {RANK_SHORT[r]}
            </Button>
          ))}
        </div>
      )}
      {canDraw && (
        <Button
          size="lg"
          variant="accent"
          onClick={() => send({ type: 'DRAW', side })}
          disabled={sending}
        >
          🎣 Go fish
        </Button>
      )}
    </div>
  )
}
