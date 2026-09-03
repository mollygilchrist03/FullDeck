import type { Card } from '../../types/card'
import { rankValue } from '../../lib/rank'

export type Guess = 'higher' | 'lower'
export type Judgement = 'correct' | 'wrong' | 'push'

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
