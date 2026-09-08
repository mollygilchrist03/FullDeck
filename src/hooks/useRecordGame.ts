import { useEffect, useRef } from 'react'
import { useAuth } from './authContext.js'
import type { GameKey } from '../lib/leaderboard.js'

/**
 * Save a finished game to the signed-in account's history — exactly once per
 * game. Pass a `terminal` flag plus the row to record; it fires the POST when
 * `terminal` first becomes true and re-arms when it goes back to false (a new
 * game). A no-op when nobody is signed in. Fire-and-forget: a failed save
 * never surfaces to the player.
 */
export function useRecordGameOnce(entry: {
  terminal: boolean
  game: GameKey
  score: number
  detail: string
}): void {
  const { user } = useAuth()
  const done = useRef(false)

  useEffect(() => {
    if (!entry.terminal) {
      done.current = false
      return
    }
    if (done.current || !user) return
    done.current = true
    void fetch('/api/history', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: entry.game, score: entry.score, detail: entry.detail }),
    }).catch(() => {})
  }, [entry.terminal, entry.game, entry.score, entry.detail, user])
}
