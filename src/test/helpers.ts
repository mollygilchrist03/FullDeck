import type { Card, Rank, Suit } from '../types/card'

const SUIT_CODE: Record<Suit, string> = {
  HEARTS: 'H',
  DIAMONDS: 'D',
  CLUBS: 'C',
  SPADES: 'S',
}

const RANK_CODE: Record<Rank, string> = {
  ACE: 'A',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '0',
  JACK: 'J',
  QUEEN: 'Q',
  KING: 'K',
}

/** Build a Card for tests. `card('ACE', 'SPADES')` or the shorthand `card('AS')`. */
export function card(rank: Rank, suit: Suit = 'SPADES'): Card {
  const code = `${RANK_CODE[rank]}${SUIT_CODE[suit]}`
  return { code, rank, suit, image: `https://deckofcardsapi.com/static/img/${code}.png` }
}

/** Build a hand from a list of ranks (all spades — suit is irrelevant to scoring). */
export function hand(...ranks: Rank[]): Card[] {
  return ranks.map((r) => card(r))
}

const ALL_RANKS: Rank[] = [
  'ACE', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'JACK', 'QUEEN', 'KING',
]
const ALL_SUITS: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES']

/** A full 52-card deck, in order. */
export function fullDeck(): Card[] {
  return ALL_SUITS.flatMap((s) => ALL_RANKS.map((r) => card(r, s)))
}

/** A full deck, shuffled with Math.random — for completion/fuzz tests. */
export function shuffledDeck(): Card[] {
  const d = fullDeck()
  for (let i = d.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}
