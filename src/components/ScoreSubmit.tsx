import { useEffect, useRef, useState } from 'react'
import { Button } from './Button.js'
import { Spinner } from './Loading.js'
import { submitScore } from '../hooks/useLeaderboard.js'
import { useAuth } from '../hooks/authContext.js'
import { formatScore, GAMES, NAME_MAX, type GameKey } from '../lib/leaderboard.js'
import { isCleanName } from '../lib/profanity.js'

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

/** Compact "add this result to the shared leaderboard" box for a game's end
 * screen. Signed-in players post under their account name; if they've turned
 * on auto-post it happens on its own with no form at all. */
export function ScoreSubmit({ game, score }: ScoreSubmitProps) {
  const meta = GAMES[game]
  const { user } = useAuth()
  const [name, setName] = useState(() => user?.displayName ?? loadName())
  const [website, setWebsite] = useState('') // honeypot — see the field below
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const autoTried = useRef(false)

  const inRange = score >= meta.min && score <= meta.max

  const send = async (submitName: string, remember: boolean) => {
    setStatus('sending')
    setMessage(null)
    if (remember) rememberName(submitName)
    const result = await submitScore(game, submitName, score, website)
    if (result.ok) {
      setStatus('done')
      const who = result.name ? ` as ${result.name}` : ''
      setMessage(result.rank ? `Posted${who} — you're #${result.rank}.` : `Posted${who}.`)
    } else {
      setStatus('error')
      setMessage(result.error ?? 'Could not submit.')
    }
  }

  // Auto-post once for opted-in accounts.
  useEffect(() => {
    if (!inRange || autoTried.current) return
    if (user?.autoPost) {
      autoTried.current = true
      void send(user.displayName, false)
    }
  }, [inRange, user]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!inRange) return null

  const submitTyped = () => {
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
    void send(trimmed, !user)
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-gold/30 bg-black/20 p-4 text-center">
      <p className="text-xs uppercase tracking-widest text-gold/80">
        {meta.metricLabel}: <span className="text-card">{formatScore(game, score)}</span>
      </p>

      {status === 'done' ? (
        <p className="mt-2 text-sm font-semibold text-gold">{message}</p>
      ) : user?.autoPost ? (
        <p className="mt-2 text-sm text-card/70">
          {status === 'sending' ? 'Posting to the leaderboard…' : message}
        </p>
      ) : (
        <>
          <div className="mt-3 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX}
              placeholder="Your name"
              className="min-w-0 flex-1 rounded-lg border border-gold/40 bg-felt px-3 py-2 text-sm text-card placeholder:text-card/40 focus:border-gold focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && submitTyped()}
            />
            {/* Honeypot: invisible to a real visitor (off-screen, unlabelled,
                skipped by tab order and screen readers), but a form-filling
                bot that populates every input tends to fill it in. */}
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              aria-hidden="true"
              autoComplete="off"
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
            />
            <Button variant="gold" onClick={submitTyped} disabled={status === 'sending'}>
              {status === 'sending' ? <Spinner className="h-4 w-4" /> : 'Submit'}
            </Button>
          </div>
          {user ? (
            <p className="mt-2 text-xs text-card/50">
              Posting as <strong className="text-card/70">{user.displayName}</strong>. Turn on
              auto-post in your account to skip this.
            </p>
          ) : null}
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
