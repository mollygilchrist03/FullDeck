import { Card } from '../../../components/Card'
import type { Card as CardData } from '../../../types/card'
import { scoreHand } from '../handScoring'

interface HandProps {
  label: string
  cards: CardData[]
  /** Hide the second card and its value (dealer's hole card). */
  holeHidden?: boolean
  handId: number
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

export function Hand({ label, cards, holeHidden = false, handId }: HandProps) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gold/90">{label}</h2>
        <span className="rounded-md bg-black/25 px-2 py-0.5 text-sm font-bold text-card tabular-nums">
          {totalLabel(cards, holeHidden)}
        </span>
      </div>
      <div className="flex min-h-[7.5rem] flex-wrap gap-2">
        {cards.map((card, i) => {
          const hidden = holeHidden && i === 1
          return (
            <div key={`${handId}-${i}-${card.code}`} className="w-16 sm:w-20">
              <Card card={card} faceDown={hidden} dealt />
            </div>
          )
        })}
      </div>
    </section>
  )
}
