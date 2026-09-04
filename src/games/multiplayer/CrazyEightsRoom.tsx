import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import type { Suit } from '../../types/card'
import { isPlayable } from '../crazyeights/crazyEightsLogic'
import {
  canDraw,
  sideHasMove,
  topCard,
  type CrazyEightsState,
} from '../crazyeights/crazyEightsReducer'
import type { MpBoardProps } from './mpBoards'

const SUIT_GLYPH: Record<Suit, string> = { HEARTS: '♥', DIAMONDS: '♦', CLUBS: '♣', SPADES: '♠' }
const SUITS: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES']
const isRed = (s: Suit) => s === 'HEARTS' || s === 'DIAMONDS'

export function CrazyEightsRoom({ view, send }: MpBoardProps) {
  const s = view.state as CrazyEightsState
  const seat = view.youSeat ?? 0
  const spectator = view.youSeat === null
  const side = seat === 0 ? 'player' : 'ai'
  const myHand = side === 'player' ? s.playerHand : s.aiHand
  const theirHand = side === 'player' ? s.aiHand : s.playerHand
  const myPhase = side === 'player' ? 'playerTurn' : 'aiTurn'
  const top = s.discard.length ? topCard(s) : null
  const over = s.phase === 'gameover'
  const myTurn = !spectator && s.phase === myPhase
  const iAwaitSuit = !spectator && s.phase === 'awaitSuit' && s.wildSide === side
  const legal = (i: number) => (top ? isPlayable(myHand[i], top, s.activeSuit) : false)
  const hasMove = myTurn && sideHasMove(s, side)
  const mustDraw = myTurn && !hasMove && canDraw(s)
  const mustPass = myTurn && !hasMove && !canDraw(s)

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <p className="text-xs uppercase tracking-widest text-gold/80">
          Opponent — {theirHand.length} card{theirHand.length === 1 ? '' : 's'}
        </p>
        <div className="flex">
          {theirHand.slice(0, 14).map((_, i) => (
            <div key={i} className="-ml-6 w-9 first:ml-0">
              <Card faceDown />
            </div>
          ))}
        </div>
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
          ? s.winner === side
            ? s.stalemate
              ? 'Deadlock — you had fewer cards. You win.'
              : 'You went out — you win!'
            : s.stalemate
              ? 'Deadlock — your opponent had fewer cards. You lose.'
              : 'Your opponent went out. You lose.'
          : s.log[s.log.length - 1]}
      </p>

      {iAwaitSuit && (
        <div className="flex gap-2">
          {SUITS.map((su) => (
            <button
              key={su}
              type="button"
              onClick={() => send({ type: 'CHOOSE_SUIT', suit: su, side })}
              className={`h-12 w-12 rounded-lg border border-gold/50 bg-felt text-2xl ${
                isRed(su) ? 'text-casino' : 'text-card'
              } hover:border-gold`}
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
              onClick={myTurn && legal(i) ? () => send({ type: 'PLAY', index: i, side }) : undefined}
              disabled={!myTurn || !legal(i)}
              className={myTurn && legal(i) ? 'ring-2 ring-gold' : 'opacity-55'}
            />
          </div>
        ))}
      </div>

      {myTurn && !iAwaitSuit && (
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => send({ type: 'DRAW', side })} disabled={!mustDraw}>
              Draw
            </Button>
            <Button variant="accent" onClick={() => send({ type: 'PASS', side })} disabled={!mustPass}>
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
        <p className="text-xs text-card/50">Opponent&apos;s turn…</p>
      )}
    </div>
  )
}
