import type { ApiCard, Card, DrawResult, Rank, Suit } from '../types/card'

const BASE = 'https://deckofcardsapi.com/api/deck'

interface NewDeckResponse {
  success: boolean
  deck_id: string
  remaining: number
  shuffled: boolean
}

interface DrawResponse {
  success: boolean
  deck_id: string
  cards: ApiCard[]
  remaining: number
}

interface ShuffleResponse {
  success: boolean
  deck_id: string
  remaining: number
}

const VALUE_TO_RANK: Record<string, Rank> = {
  ACE: 'ACE',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  JACK: 'JACK',
  QUEEN: 'QUEEN',
  KING: 'KING',
}

function toCard(api: ApiCard): Card {
  const rank = VALUE_TO_RANK[api.value]
  if (!rank) throw new Error(`Unexpected card value from API: ${api.value}`)
  return {
    code: api.code,
    rank,
    suit: api.suit as Suit,
    image: api.images?.png ?? api.image,
  }
}

async function getJson<T extends { success: boolean }>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Deck of Cards API request failed (${res.status})`)
  const data = (await res.json()) as T
  if (!data.success) throw new Error('Deck of Cards API returned success: false')
  return data
}

/** Create a fresh, single, shuffled deck. */
export async function newDeck(): Promise<{ deckId: string; remaining: number }> {
  const data = await getJson<NewDeckResponse>(`${BASE}/new/shuffle/?deck_count=1`)
  return { deckId: data.deck_id, remaining: data.remaining }
}

/** Draw `count` cards from an existing deck. */
export async function draw(deckId: string, count: number): Promise<DrawResult> {
  const data = await getJson<DrawResponse>(`${BASE}/${deckId}/draw/?count=${count}`)
  return { cards: data.cards.map(toCard), remaining: data.remaining }
}

/** Reshuffle a deck (all 52 cards back in). Handy for Memory Match resets. */
export async function shuffle(deckId: string): Promise<{ remaining: number }> {
  const data = await getJson<ShuffleResponse>(`${BASE}/${deckId}/shuffle/`)
  return { remaining: data.remaining }
}
