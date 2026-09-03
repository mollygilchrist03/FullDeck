export type Suit = 'HEARTS' | 'DIAMONDS' | 'CLUBS' | 'SPADES'

export type Rank =
  | 'ACE'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'JACK'
  | 'QUEEN'
  | 'KING'

/** Normalised card used everywhere in the app. `code` (e.g. "AS", "0H", "KD") is its identity. */
export interface Card {
  code: string
  rank: Rank
  suit: Suit
  image: string
}

/** Raw card shape returned by the Deck of Cards API. */
export interface ApiCard {
  code: string
  value: string
  suit: string
  image: string
  images: { svg: string; png: string }
}

export interface DrawResult {
  cards: Card[]
  remaining: number
}
