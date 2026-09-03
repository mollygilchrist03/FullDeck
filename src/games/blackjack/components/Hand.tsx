import type { ReactNode } from 'react'
import { Card } from '../../../components/Card'
import type { Card as CardData } from '../../../types/card'
import { scoreHand } from '../handScoring'

interface HandProps {
  label: string
  cards: CardData[]
  /** Hide the second card and its value (dealer's hole card). */
  holeHidden?: boolean
  handId: number
  /** Small chips shown next to the total (bet, result, "double"). */
  meta?: ReactNode
  /** Gold outline — the hand currently being played. */
  active?: boolean
  /** Dim finished / inactive hands. */
  muted?: boolean
  /** Smaller cards when several hands share the row. */
  compact?: boolean
}

function totalLabel(cards: CardData[], holeHidden: boolean): string {
  if (cards.length === 0) return '—'
  if (holeHidden) {
    // Only the first (up) card is known to the player.
    return `${scoreHand(cards.slice(0, 1)).total} + ?`
  }
  const { total, soft } = scoreHand(cards)
  if (total > 21) return `${total} — bust`
  return soft ? `${total - 10}/${total}` : `${total}`
}

export function Hand({
  label,
  cards,
  holeHidden = false,
  handId,
  meta,
  active = false,
  muted = false,
  compact = false,
}: HandProps) {
  return (
    <section
      className={`flex flex-col gap-2 rounded-xl p-2 transition-colors ${
        active ? 'bg-gold/10 ring-1 ring-gold' : ''
      } ${muted ? 'opacity-60' : ''}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gold/90">{label}</h2>
        <div className="flex items-center gap-1.5">
          {meta}
          <span className="rounded-md bg-black/25 px-2 py-0.5 text-sm font-bold tabular-nums text-card">
            {totalLabel(cards, holeHidden)}
          </span>
        </div>
      </div>
      <div className={`flex flex-wrap gap-2 ${compact ? 'min-h-[6rem]' : 'min-h-[7.5rem]'}`}>
        {cards.map((card, i) => {
          const hidden = holeHidden && i === 1
          return (
            <div
              key={`${handId}-${i}-${card.code}`}
              className={compact ? 'w-12 sm:w-14' : 'w-16 sm:w-20'}
            >
              <Card card={card} faceDown={hidden} dealt />
            </div>
          )
        })}
      </div>
    </section>
  )
}
