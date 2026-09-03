import { useState } from 'react'
import type { Card as CardData, Suit } from '../types/card'

interface CardProps {
  card?: CardData
  /** When true, the back of the card faces the player. */
  faceDown: boolean
  onClick?: () => void
  /** Gold ring pulse — used for a Memory Match success. */
  pulse?: boolean
  /** Deal-in animation on mount. */
  dealt?: boolean
  disabled?: boolean
  className?: string
  /** Overrides the accessible label for interactive cards. */
  label?: string
}

const SUIT_GLYPH: Record<Suit, string> = {
  HEARTS: '♥',
  DIAMONDS: '♦',
  CLUBS: '♣',
  SPADES: '♠',
}

const RANK_LABEL: Record<string, string> = {
  ACE: 'A',
  JACK: 'J',
  QUEEN: 'Q',
  KING: 'K',
}

function CardFront({ card }: { card: CardData }) {
  const [imgOk, setImgOk] = useState(true)
  const isRed = card.suit === 'HEARTS' || card.suit === 'DIAMONDS'
  const rank = RANK_LABEL[card.rank] ?? card.rank
  const glyph = SUIT_GLYPH[card.suit]

  if (imgOk) {
    return (
      <img
        src={card.image}
        alt={`${rank} of ${card.suit.toLowerCase()}`}
        className="h-full w-full object-contain bg-card"
        draggable={false}
        onError={() => setImgOk(false)}
      />
    )
  }

  // CSS fallback if the API image fails to load.
  return (
    <div
      className={`flex h-full w-full flex-col justify-between bg-card p-1.5 font-display ${
        isRed ? 'text-casino' : 'text-ink'
      }`}
      aria-label={`${rank} of ${card.suit.toLowerCase()}`}
    >
      <span className="text-sm font-bold leading-none">
        {rank}
        <span className="block text-xs">{glyph}</span>
      </span>
      <span className="self-center text-2xl">{glyph}</span>
      <span className="rotate-180 text-sm font-bold leading-none">
        {rank}
        <span className="block text-xs">{glyph}</span>
      </span>
    </div>
  )
}

function CardBack() {
  return (
    <div className="h-full w-full bg-felt p-1.5">
      <div className="flex h-full w-full items-center justify-center rounded-md border-2 border-gold/70 bg-[repeating-linear-gradient(45deg,rgba(201,162,39,0.18)_0_6px,transparent_6px_12px)]">
        <span className="text-2xl text-gold/90">♠</span>
      </div>
    </div>
  )
}

export function Card({
  card,
  faceDown,
  onClick,
  pulse = false,
  dealt = false,
  disabled = false,
  className = '',
  label,
}: CardProps) {
  const interactive = Boolean(onClick)
  const sceneClass =
    `card-scene block aspect-[5/7] w-full rounded-[0.55rem] ` +
    `${dealt ? 'animate-deal ' : ''}${pulse ? 'animate-pulse-match ' : ''}${className}`

  const inner = (
    <div className={`card-flipper ${faceDown ? 'is-face-down' : ''}`}>
      <div className="card-face card-face--front border border-black/10 shadow-md shadow-black/30">
        {card ? <CardFront card={card} /> : <CardBack />}
      </div>
      <div className="card-face card-face--back border border-black/10 shadow-md shadow-black/30">
        <CardBack />
      </div>
    </div>
  )

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={
          label ?? (faceDown ? 'Face-down card' : card ? `${card.rank} of ${card.suit.toLowerCase()}` : 'Card')
        }
        className={`${sceneClass} cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold`}
      >
        {inner}
      </button>
    )
  }

  return <div className={sceneClass}>{inner}</div>
}
