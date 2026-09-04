import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { Button } from '../../components/Button'
import { GAMES } from '../../lib/leaderboard'
import { MP_GAMES, normalizeCode, type MpGameKey } from '../../lib/multiplayer'
import { createRoom, joinRoom } from '../../hooks/useRoom'

const NAME_KEY = 'fulldeck:name'
const loadName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}
const rememberName = (n: string) => {
  try {
    localStorage.setItem(NAME_KEY, n)
  } catch {
    /* private mode */
  }
}

export function Multiplayer() {
  const nav = useNavigate()
  const [name, setName] = useState(loadName)
  const [game, setGame] = useState<MpGameKey>(MP_GAMES[0])
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const go = async (fn: () => Promise<string | void>, then: (code?: string) => void) => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter your name first.')
      return
    }
    rememberName(trimmed)
    setBusy(true)
    setError(null)
    try {
      const result = await fn()
      then(typeof result === 'string' ? result : undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const host = () =>
    go(
      () => createRoom(game, name.trim()),
      (c) => c && nav(`/room/${c}`),
    )

  const join = () => {
    const c = normalizeCode(code)
    if (c.length !== 6) {
      setError('A room code is six characters.')
      return
    }
    go(
      () => joinRoom(c, name.trim()),
      () => nav(`/room/${c}`),
    )
  }

  return (
    <Layout title="Play with a friend">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <label className="flex flex-col gap-1 text-sm text-card/80">
          Your name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
            placeholder="Your name"
            className="rounded-lg border border-gold/40 bg-felt px-3 py-2 text-card placeholder:text-card/40 focus:border-gold focus:outline-none"
          />
        </label>

        <div className="rounded-2xl border border-gold/30 bg-felt p-5">
          <h2 className="font-display text-lg font-bold text-card">Host a game</h2>
          <p className="mt-1 text-sm text-card/70">
            You get a 6-character code to share. Two players, same link.
          </p>
          <label className="mt-3 flex flex-col gap-1 text-sm text-card/80">
            Game
            <select
              value={game}
              onChange={(e) => setGame(e.target.value as MpGameKey)}
              className="rounded-lg border border-gold/40 bg-felt px-3 py-2 text-card focus:border-gold focus:outline-none"
            >
              {MP_GAMES.map((k) => (
                <option key={k} value={k}>
                  {GAMES[k].title}
                </option>
              ))}
            </select>
          </label>
          <Button variant="gold" className="mt-4 w-full" onClick={host} disabled={busy}>
            Create room
          </Button>
        </div>

        <div className="rounded-2xl border border-gold/30 bg-felt p-5">
          <h2 className="font-display text-lg font-bold text-card">Join a game</h2>
          <div className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
              placeholder="ABC123"
              className="w-40 rounded-lg border border-gold/40 bg-felt px-3 py-2 text-center font-mono text-lg tracking-widest text-card placeholder:text-card/30 focus:border-gold focus:outline-none"
            />
            <Button variant="accent" className="flex-1" onClick={join} disabled={busy}>
              Join
            </Button>
          </div>
        </div>

        {error && <p className="text-center text-sm text-casino">{error}</p>}
        {!name.trim() && <p className="text-center text-xs text-card/50">Enter a name to get started.</p>}
      </div>
    </Layout>
  )
}
