import type { Card } from '../../types/card'

const POSITION: Record<string, number> = {
  ACE: 0,
  '2': 1,
  '3': 2,
  '4': 3,
  '5': 4,
  '6': 5,
  '7': 6,
  '8': 7,
  '9': 8,
  '10': 9,
}

export type Placement = number | 'wild' | 'dead'

/**
 * Where a drawn card goes in a layout of `size` slots:
 * a numbered slot index (0 = Ace), 'wild' for a Queen, or 'dead' for a Jack,
 * King, or a number whose slot is beyond this layout.
 */
export function placementFor(card: Card, size: number): Placement {
  if (card.rank === 'QUEEN') return 'wild'
  const idx = POSITION[card.rank]
  if (idx === undefined || idx >= size) return 'dead'
  return idx
}

export const isLayoutComplete = (slots: { locked: Card | null }[]): boolean =>
  slots.every((s) => s.locked !== null)

/** Lowest still-face-down slot, or -1 if the layout is complete. */
export const firstOpenSlot = (slots: { locked: Card | null }[]): number =>
  slots.findIndex((s) => s.locked === null)
