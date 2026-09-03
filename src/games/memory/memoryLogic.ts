import type { Card } from '../../types/card'

export interface Tile {
  /** Unique per tile (both halves of a pair differ here). */
  id: number
  /** Shared within a pair — the match key. */
  code: string
  image: string
}

export type Shuffle = <T>(items: T[]) => T[]

/** Fisher–Yates. Returns a new array; does not mutate the input. */
export const shuffleArray: Shuffle = (items) => {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Take `pairs` cards, duplicate each into two tiles sharing a `code`,
 * and lay them out in randomised order. `shuffle` is injectable for tests.
 */
export function buildBoard(cards: Card[], pairs: number, shuffle: Shuffle = shuffleArray): Tile[] {
  const chosen = cards.slice(0, pairs)
  if (chosen.length < pairs) {
    throw new Error(`buildBoard needs ${pairs} cards, got ${chosen.length}`)
  }
  const tiles = chosen.flatMap((card, i) => [
    { id: i * 2, code: card.code, image: card.image },
    { id: i * 2 + 1, code: card.code, image: card.image },
  ])
  return shuffle(tiles)
}

export function isMatch(a: Tile, b: Tile): boolean {
  return a.id !== b.id && a.code === b.code
}

export function isWin(matchedCount: number, tileCount: number): boolean {
  return tileCount > 0 && matchedCount === tileCount
}
