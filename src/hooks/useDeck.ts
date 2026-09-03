import { useCallback, useRef, useState } from 'react'
import * as deckApi from '../api/deckClient'
import type { Card } from '../types/card'

interface UseDeck {
  /** Current deck id, or null before the first draw / `startNewDeck`. */
  deckId: string | null
  /** Cards left in the deck after the last operation. */
  remaining: number
  /** True while any network request is in flight. */
  loading: boolean
  /** Last error message, or null. */
  error: string | null
  /** Fetch a brand-new shuffled deck. Resolves to the new deck id. */
  startNewDeck: () => Promise<string>
  /**
   * Draw `count` cards. Auto-reshuffles first if the deck is too low
   * (repeated Blackjack hands eventually run a single deck dry).
   */
  drawCards: (count: number) => Promise<Card[]>
  /** Reshuffle the full deck (all 52 back in), then draw `count` fresh cards. */
  reshuffleAndDraw: (count: number) => Promise<Card[]>
}

export function useDeck(): UseDeck {
  const deckIdRef = useRef<string | null>(null)
  const remainingRef = useRef(0)

  const [deckId, setDeckId] = useState<string | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setRemain = useCallback((n: number) => {
    remainingRef.current = n
    setRemaining(n)
  }, [])

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true)
    setError(null)
    try {
      return await fn()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong talking to the deck service.'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const ensureDeck = useCallback(async (): Promise<string> => {
    if (deckIdRef.current) return deckIdRef.current
    const { deckId: id, remaining: rem } = await deckApi.newDeck()
    deckIdRef.current = id
    setDeckId(id)
    setRemain(rem)
    return id
  }, [setRemain])

  const startNewDeck = useCallback(
    () =>
      run(async () => {
        const { deckId: id, remaining: rem } = await deckApi.newDeck()
        deckIdRef.current = id
        setDeckId(id)
        setRemain(rem)
        return id
      }),
    [run, setRemain],
  )

  const drawCards = useCallback(
    (count: number) =>
      run(async () => {
        const id = await ensureDeck()
        if (remainingRef.current < count) {
          const s = await deckApi.shuffle(id)
          setRemain(s.remaining)
        }
        const { cards, remaining: rem } = await deckApi.draw(id, count)
        setRemain(rem)
        return cards
      }),
    [run, ensureDeck, setRemain],
  )

  const reshuffleAndDraw = useCallback(
    (count: number) =>
      run(async () => {
        const id = await ensureDeck()
        const s = await deckApi.shuffle(id)
        setRemain(s.remaining)
        const { cards, remaining: rem } = await deckApi.draw(id, count)
        setRemain(rem)
        return cards
      }),
    [run, ensureDeck, setRemain],
  )

  return { deckId, remaining, loading, error, startNewDeck, drawCards, reshuffleAndDraw }
}
