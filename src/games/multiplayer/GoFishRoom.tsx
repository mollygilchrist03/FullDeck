import { useState } from 'react'
import { Button } from '../../components/Button.js'
import { Card } from '../../components/Card.js'
import type { Rank } from '../../types/card.js'
import { ranksIn } from '../gofish/goFishLogic.js'
import type { GoFishState } from '../gofish/goFishReducer.js'
import type { MpBoardProps } from './mpBoards.js'

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
  const seat = view.youSeat
  const spectator = seat === null
  const myHand = seat !== null ? s.hands[seat] : []
  const myBooks = seat !== null ? s.books[seat] : []
  const over = s.phase === 'gameover'
  const canAsk = !spectator && s.phase === 'ask' && s.turn === seat
  const canDraw = !spectator && s.phase === 'draw' && s.turn === seat
  const myRanks = ranksIn(myHand).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
  const others = s.hands.map((_, i) => i).filter((i) => i !== seat)

  const [askRank, setAskRank] = useState<Rank | null>(null)

  const startAsk = (rank: Rank) => {
    if (seat === null) return
    // Only one possible person to ask — skip the target picker entirely.
    if (others.length === 1) {
      send({ type: 'ASK', rank, target: others[0], seat })
      return
    }
    setAskRank(rank)
  }
  const finishAsk = (target: number) => {
    if (seat === null || askRank === null) return
    send({ type: 'ASK', rank: askRank, target, seat })
    setAskRank(null)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center gap-4">
        {s.hands.map((hand, i) => {
          if (i === seat) return null
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <p className="text-xs uppercase tracking-widest text-gold/80">
                Seat {i + 1} — {hand.length} card{hand.length === 1 ? '' : 's'} · {s.books[i].length} books
              </p>
              <div className="flex">
                {hand.slice(0, 14).map((_, ci) => (
                  <div key={ci} className="-ml-6 w-9 first:ml-0">
                    <Card faceDown />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex w-full max-w-md justify-around text-center text-sm">
        <span className="text-card/70">Your books: {myBooks.length}</span>
      </div>

      <button
        type="button"
        onClick={() => seat !== null && send({ type: 'DRAW', seat })}
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
          ? s.winner === seat
            ? `You win with ${myBooks.length} books!`
            : `Seat ${(s.winner ?? 0) + 1} wins.`
          : canAsk
            ? askRank
              ? 'Who do you want to ask?'
              : 'Your turn — ask for a rank you hold.'
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

      {canAsk && askRank && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center gap-2">
            {others.map((i) => (
              <Button key={i} variant="gold" onClick={() => finishAsk(i)} disabled={sending}>
                Seat {i + 1}
              </Button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setAskRank(null)} disabled={sending}>
            Cancel
          </Button>
        </div>
      )}
      {canAsk && !askRank && (
        <div className="flex flex-wrap justify-center gap-2">
          {myRanks.map((r) => (
            <Button key={r} variant="gold" onClick={() => startAsk(r)} disabled={sending}>
              {RANK_SHORT[r]}
            </Button>
          ))}
        </div>
      )}
      {canDraw && (
        <Button
          size="lg"
          variant="accent"
          onClick={() => seat !== null && send({ type: 'DRAW', seat })}
          disabled={sending}
        >
          🎣 Go fish
        </Button>
      )}
    </div>
  )
}
