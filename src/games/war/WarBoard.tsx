import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import type { WarState } from './warReducer'

function Pile({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-24 w-16 sm:h-28 sm:w-20">
        {count > 0 ? (
          <>
            {count > 2 && <Card faceDown className="absolute left-1 top-1 opacity-60" />}
            {count > 1 && <Card faceDown className="absolute left-0.5 top-0.5 opacity-80" />}
            <Card faceDown className="absolute inset-0" />
          </>
        ) : (
          <div className="h-full w-full rounded-[0.55rem] border border-dashed border-card/30" />
        )}
      </div>
      <p className="text-xs uppercase tracking-widest text-gold/80">{label}</p>
      <p className="text-lg font-bold tabular-nums text-card">{count}</p>
    </div>
  )
}

interface WarBoardProps {
  state: WarState
  /** Which side is "you": 0 = the player pile, 1 = the dealer pile. */
  mySeat: 0 | 1
  onFlip: () => void
  flipDisabled?: boolean
  /** Text below the piles when nobody can flip (e.g. "waiting for host"). */
  waitingNote?: string
}

export function WarBoard({ state, mySeat, onFlip, flipDisabled = false, waitingNote }: WarBoardProps) {
  const mineKey = mySeat === 0 ? 'player' : 'dealer'
  const myPile = mySeat === 0 ? state.playerPile : state.dealerPile
  const theirPile = mySeat === 0 ? state.dealerPile : state.playerPile
  const myCard = mySeat === 0 ? state.playerCard : state.dealerCard
  const theirCard = mySeat === 0 ? state.dealerCard : state.playerCard

  const atWar = state.phase === 'war'
  const over = state.phase === 'gameover'
  const iWon = state.winner === mineKey
  const potOnTable = state.pot.length + (state.playerCard ? 1 : 0) + (state.dealerCard ? 1 : 0)

  const banner = over
    ? iWon
      ? 'You take the whole deck — you win!'
      : 'Your opponent has every card. You lose.'
    : atWar
      ? state.buried > 0
        ? `War! ${state.buried} cards face down, ${potOnTable} on the line — flip again.`
        : 'Tie — this means war. Flip again: three cards down, one up.'
      : state.lastWinner
        ? `${state.lastWinner === mineKey ? 'You' : 'Opponent'} won ${state.lastPotSize} card${
            state.lastPotSize === 1 ? '' : 's'
          }.`
        : 'Flip a card. Higher rank wins the pair; a tie means war.'

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex w-full max-w-md items-start justify-between">
        <Pile label="Opponent" count={theirPile.length} />
        <div className="pt-8 text-center">
          <p className="text-xs uppercase tracking-widest text-gold/80">Battles</p>
          <p className="text-lg font-bold tabular-nums text-card">{state.battles}</p>
        </div>
        <Pile label="You" count={myPile.length} />
      </div>

      <div className="flex min-h-[9rem] items-center justify-center gap-6">
        <div className="w-20 sm:w-24">
          {theirCard ? (
            <Card card={theirCard} faceDown={false} dealt />
          ) : (
            <div className="aspect-[5/7] w-full rounded-[0.55rem] border border-dashed border-card/25" />
          )}
        </div>
        <span className="font-display text-xl text-gold">vs</span>
        <div className="w-20 sm:w-24">
          {myCard ? (
            <Card card={myCard} faceDown={false} dealt />
          ) : (
            <div className="aspect-[5/7] w-full rounded-[0.55rem] border border-dashed border-card/25" />
          )}
        </div>
      </div>

      <p
        className={`min-h-6 text-center font-semibold ${
          over ? 'font-display text-xl text-gold' : atWar ? 'text-casino' : 'text-card/80'
        }`}
        role="status"
        aria-live="polite"
      >
        {banner}
      </p>

      {!over &&
        (waitingNote ? (
          <p className="text-sm text-card/60">{waitingNote}</p>
        ) : (
          <Button
            size="lg"
            variant={atWar ? 'accent' : 'gold'}
            onClick={onFlip}
            disabled={flipDisabled}
          >
            {atWar ? 'Go to war' : 'Battle'}
          </Button>
        ))}
    </div>
  )
}
