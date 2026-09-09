import { Button } from '../../components/Button.js'
import { Card } from '../../components/Card.js'
import type { Suit } from '../../types/card.js'
import { isPlayable } from '../crazyeights/crazyEightsLogic.js'
import {
  canDraw,
  seatHasMove,
  topCard,
  type CrazyEightsState,
} from '../crazyeights/crazyEightsReducer.js'
import type { MpBoardProps } from './mpBoards.js'

const SUIT_GLYPH: Record<Suit, string> = { HEARTS: '♥', DIAMONDS: '♦', CLUBS: '♣', SPADES: '♠' }
const SUITS: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES']
const isRed = (s: Suit) => s === 'HEARTS' || s === 'DIAMONDS'

export function CrazyEightsRoom({ view, send, sending }: MpBoardProps) {
  const s = view.state as CrazyEightsState
  const seat = view.youSeat
  const spectator = seat === null
  const myHand = seat !== null ? s.hands[seat] : []
  const top = s.discard.length ? topCard(s) : null
  const over = s.phase === 'gameover'
  const myTurn = !spectator && s.phase === 'turn' && s.turn === seat
  const iAwaitSuit = !spectator && s.phase === 'awaitSuit' && s.wildSeat === seat
  const legal = (i: number) => (top ? isPlayable(myHand[i], top, s.activeSuit) : false)
  const hasMove = myTurn && seat !== null && seatHasMove(s, seat)
  const mustDraw = myTurn && !hasMove && canDraw(s)
  const mustPass = myTurn && !hasMove && !canDraw(s)

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center gap-4">
        {s.hands.map((hand, i) => {
          if (i === seat) return null
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <p className="text-xs uppercase tracking-widest text-gold/80">
                Seat {i + 1} — {hand.length} card{hand.length === 1 ? '' : 's'}
              </p>
              <div className="flex">
                {hand.slice(0, 12).map((_, ci) => (
                  <div key={ci} className="-ml-6 w-9 first:ml-0">
                    <Card faceDown />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {top && (
        <div className="flex items-center gap-6">
          <div className="w-20 sm:w-24">
            <Card card={top} faceDown={false} dealt />
          </div>
          <span
            className={`rounded-md bg-black/25 px-2 py-0.5 text-sm font-bold ${
              isRed(s.activeSuit) ? 'text-casino' : 'text-card'
            }`}
          >
            {SUIT_GLYPH[s.activeSuit]}{' '}
            {s.activeSuit[0] + s.activeSuit.slice(1).toLowerCase()}
          </span>
        </div>
      )}

      <p className="min-h-5 text-center text-sm text-card/75" role="status" aria-live="polite">
        {over
          ? s.winner === seat
            ? s.stalemate
              ? 'Deadlock — you had fewer cards. You win.'
              : 'You went out — you win!'
            : s.stalemate
              ? `Deadlock — Seat ${(s.winner ?? 0) + 1} had fewer cards.`
              : `Seat ${(s.winner ?? 0) + 1} went out.`
          : s.log[s.log.length - 1]}
      </p>

      {iAwaitSuit && (
        <div className="flex gap-2">
          {SUITS.map((su) => (
            <button
              key={su}
              type="button"
              disabled={sending}
              onClick={() => send({ type: 'CHOOSE_SUIT', suit: su, seat })}
              className={`h-12 w-12 rounded-lg border border-gold/50 bg-felt text-2xl ${
                isRed(su) ? 'text-casino' : 'text-card'
              } hover:border-gold disabled:opacity-60`}
              aria-label={su}
            >
              {SUIT_GLYPH[su]}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-1">
        {myHand.map((c, i) => (
          <div key={`${c.code}-${i}`} className="w-12 sm:w-14">
            <Card
              card={c}
              faceDown={false}
              onClick={myTurn && legal(i) ? () => send({ type: 'PLAY', index: i, seat }) : undefined}
              disabled={!myTurn || !legal(i) || sending}
              className={myTurn && legal(i) ? 'ring-2 ring-gold' : 'opacity-55'}
            />
          </div>
        ))}
      </div>

      {myTurn && !iAwaitSuit && (
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={() => send({ type: 'DRAW', seat })}
              disabled={!mustDraw || sending}
            >
              Draw
            </Button>
            <Button
              variant="accent"
              onClick={() => send({ type: 'PASS', seat })}
              disabled={!mustPass || sending}
            >
              Pass
            </Button>
          </div>
          <p className="text-xs text-card/60">
            {hasMove
              ? 'Play a highlighted card.'
              : mustDraw
                ? 'No legal card — draw until you can play.'
                : 'Nothing to play or draw — pass.'}
          </p>
        </div>
      )}
      {!myTurn && !over && !spectator && (
        <p className="text-xs text-card/50">Waiting on the table…</p>
      )}
    </div>
  )
}
