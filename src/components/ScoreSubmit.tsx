import { useState } from 'react'
import { Button } from './Button'
import { submitScore } from '../hooks/useLeaderboard'
import { formatScore, GAMES, NAME_MAX, type GameKey } from '../lib/leaderboard'
import { isCleanName } from '../lib/profanity'

const NAME_STORAGE_KEY = 'fulldeck:name'

function loadName(): string {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function rememberName(name: string): void {
  try {
    localStorage.setItem(NAME_STORAGE_KEY, name)
  } catch {
    /* private mode / storage disabled — not important */
  }
}

interface ScoreSubmitProps {
  game: GameKey
  score: number
}

/** Compact "add this result to the shared leaderboard" box for a game's end screen. */
export function ScoreSubmit({ game, score }: ScoreSubmitProps) {
  const meta = GAMES[game]
  const [name, setName] = useState(loadName)
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  if (score < meta.min || score > meta.max) return null

  const send = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setStatus('error')
      setMessage('Enter a name first.')
      return
    }
    if (!isCleanName(trimmed)) {
      setStatus('error')
      setMessage('Please pick a name without profanity.')
      return
    }
    setStatus('sending')
    setMessage(null)
    rememberName(trimmed)
    const result = await submitScore(game, trimmed, score)
    if (result.ok) {
      setStatus('done')
      setMessage(result.rank ? `Logged — you're #${result.rank}.` : 'Logged.')
    } else {
      setStatus('error')
      setMessage(result.error ?? 'Could not submit.')
    }
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-gold/30 bg-black/20 p-4 text-center">
      <p className="text-xs uppercase tracking-widest text-gold/80">
        {meta.metricLabel}: <span className="text-card">{formatScore(game, score)}</span>
      </p>

      {status === 'done' ? (
        <p className="mt-2 text-sm font-semibold text-gold">{message}</p>
      ) : (
        <>
          <div className="mt-3 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX}
              placeholder="Your name"
              className="min-w-0 flex-1 rounded-lg border border-gold/40 bg-felt px-3 py-2 text-sm text-card placeholder:text-card/40 focus:border-gold focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && void send()}
            />
            <Button variant="gold" onClick={() => void send()} disabled={status === 'sending'}>
              {status === 'sending' ? '…' : 'Submit'}
            </Button>
          </div>
          {message && (
            <p className={`mt-2 text-sm ${status === 'error' ? 'text-casino' : 'text-card/70'}`}>
              {message}
            </p>
          )}
        </>
      )}
    </div>
  )
}
