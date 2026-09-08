import type { Card } from '../../types/card'
import { RANK_ORDER, rankValue } from '../../lib/rank'

export type Guess = 'higher' | 'lower'
export type Judgement = 'correct' | 'wrong' | 'push'

export interface RemainingCounts {
  higher: number
  lower: number
  equal: number
}

/**
 * How many cards still in a single 52-card deck rank above / below / equal to
 * `current`, given everything already turned over this run (`seen`, which
 * includes `current` itself). `higher + lower + equal` is the size of the
 * remaining deck.
 */
export function remainingCounts(current: Card, seen: Card[]): RemainingCounts {
  const seenByRank = new Map<string, number>()
  for (const c of seen) seenByRank.set(c.rank, (seenByRank.get(c.rank) ?? 0) + 1)

  const c = rankValue(current.rank)
  const out: RemainingCounts = { higher: 0, lower: 0, equal: 0 }
  for (const rank of RANK_ORDER) {
    const left = 4 - (seenByRank.get(rank) ?? 0)
    const v = rankValue(rank)
    if (v > c) out.higher += left
    else if (v < c) out.lower += left
    else out.equal += left
  }
  return out
}

/**
 * Was `guess` right about `next` relative to `current`? Aces are high.
 * Equal ranks are a push — the run survives but doesn't advance.
 */
export function judge(current: Card, next: Card, guess: Guess): Judgement {
  const c = rankValue(current.rank)
  const n = rankValue(next.rank)
  if (n === c) return 'push'
  const wentHigher = n > c
  return (guess === 'higher') === wentHigher ? 'correct' : 'wrong'
}
