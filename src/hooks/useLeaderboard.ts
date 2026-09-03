import { useCallback, useEffect, useState } from 'react'
import type { GameKey } from '../lib/leaderboard'

export interface LeaderEntry {
  name: string
  score: number
  createdAt: string
}

interface UseLeaderboard {
  entries: LeaderEntry[]
  loading: boolean
  error: string | null
  refresh: () => void
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>
  } catch {
    // Dev server (plain `vite`) has no /api — it serves index.html instead.
    throw new Error('The leaderboard API is not available here — try a deployed build.')
  }
}

export function useLeaderboard(game: GameKey, limit = 10): UseLeaderboard {
  const [entries, setEntries] = useState<LeaderEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/scores?game=${game}&limit=${limit}`)
      const data = await readJson(res)
      if (!res.ok) throw new Error((data.error as string) ?? 'Could not load the leaderboard.')
      setEntries((data.entries as LeaderEntry[]) ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the leaderboard.')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [game, limit])

  useEffect(() => {
    void load()
  }, [load])

  return { entries, loading, error, refresh: load }
}

export interface SubmitResult {
  ok: boolean
  rank?: number
  error?: string
}

export async function submitScore(
  game: GameKey,
  name: string,
  score: number,
): Promise<SubmitResult> {
  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game, name, score }),
    })
    const data = await readJson(res)
    if (!res.ok) return { ok: false, error: (data.error as string) ?? 'Could not submit your score.' }
    return { ok: true, rank: data.rank as number }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not submit your score.' }
  }
}
