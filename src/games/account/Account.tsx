import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { Button } from '../../components/Button'
import { Loading, Spinner } from '../../components/Loading'
import { useAuth } from '../../hooks/authContext'
import { GAMES, NAME_MAX, isGameKey } from '../../lib/leaderboard'
import { PASSWORD_MIN } from '../../lib/auth'

interface HistoryRow {
  game: string
  score: number
  detail: string | null
  postedToLeaderboard: boolean
  createdAt: string
}

function History() {
  const [rows, setRows] = useState<HistoryRow[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/history')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { results: HistoryRow[] }) => setRows(d.results))
      .catch(() => setError(true))
  }, [])

  if (error) return <p className="text-sm text-card/50">Couldn’t load your history.</p>
  if (!rows) return <p className="text-sm text-card/50">Loading your games…</p>
  if (rows.length === 0)
    return <p className="text-sm text-card/60">No games saved yet — finish one and it’ll show up here.</p>

  return (
    <ul className="flex flex-col divide-y divide-gold/15 rounded-xl border border-gold/20 bg-black/20">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="font-semibold text-card">
              {isGameKey(r.game) ? GAMES[r.game].title : r.game}
              {r.postedToLeaderboard && <span className="ml-2 text-xs text-gold">· on the board</span>}
            </p>
            {r.detail && <p className="truncate text-card/60">{r.detail}</p>}
          </div>
          <time className="shrink-0 text-xs text-card/40" dateTime={r.createdAt}>
            {new Date(r.createdAt).toLocaleDateString()}
          </time>
        </li>
      ))}
    </ul>
  )
}

function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) throw new Error((data.error as string) ?? 'Something went wrong.')
      setSent((data.message as string) ?? 'If that email has an account, a reset link is on its way.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <p className="text-sm text-card/75">Enter your email and we’ll send a reset link.</p>
      {sent ? (
        <p className="text-sm text-card/80">{sent}</p>
      ) : (
        <>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-gold/40 bg-felt px-3 py-2 text-sm text-card focus:border-gold focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && void send()}
          />
          <Button variant="gold" onClick={() => void send()} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : 'Send reset link'}
          </Button>
          {error && <p className="text-sm text-casino">{error}</p>}
        </>
      )}
      <button type="button" onClick={onBack} className="text-sm text-gold hover:underline">
        Back to sign in
      </button>
    </div>
  )
}

function SignedOut() {
  const { register, login, googleEnabled } = useAuth()
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [params] = useSearchParams()

  useEffect(() => {
    if (params.get('error') === 'google') setError('Google sign-in didn’t complete. Try again.')
  }, [params])

  if (mode === 'forgot') return <ForgotPassword onBack={() => setMode('login')} />

  const submit = async () => {
    setBusy(true)
    setError(null)
    const res =
      mode === 'register'
        ? await register(email.trim(), password, displayName.trim())
        : await login(email.trim(), password)
    setBusy(false)
    if (!res.ok) setError(res.error ?? 'Something went wrong.')
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5">
      <div className="flex rounded-lg border border-gold/40 p-1 text-sm">
        {(['login', 'register'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m)
              setError(null)
            }}
            className={`flex-1 rounded-md py-1.5 font-semibold capitalize transition-colors ${
              mode === m ? 'bg-gold text-ink' : 'text-card/70 hover:text-card'
            }`}
          >
            {m === 'login' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-gold/80">
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-gold/40 bg-felt px-3 py-2 text-sm text-card focus:border-gold focus:outline-none"
          />
        </label>
        {mode === 'register' && (
          <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-gold/80">
            Display name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={NAME_MAX}
              placeholder="Shown on the leaderboard"
              className="rounded-lg border border-gold/40 bg-felt px-3 py-2 text-sm text-card placeholder:text-card/40 focus:border-gold focus:outline-none"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-gold/80">
          Password
          <input
            type="password"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-gold/40 bg-felt px-3 py-2 text-sm text-card focus:border-gold focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
          />
          {mode === 'register' && (
            <span className="text-[0.7rem] normal-case tracking-normal text-card/50">
              At least {PASSWORD_MIN} characters.
            </span>
          )}
        </label>

        <Button variant="gold" onClick={() => void submit()} disabled={busy}>
          {busy ? <Spinner className="h-4 w-4" /> : mode === 'register' ? 'Create account' : 'Sign in'}
        </Button>
        {error && <p className="text-sm text-casino">{error}</p>}
        {mode === 'login' && (
          <button
            type="button"
            onClick={() => setMode('forgot')}
            className="self-start text-xs text-card/60 hover:text-gold hover:underline"
          >
            Forgot your password?
          </button>
        )}
      </div>

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3 text-xs text-card/40">
            <span className="h-px flex-1 bg-card/20" />
            or
            <span className="h-px flex-1 bg-card/20" />
          </div>
          <a
            href="/api/auth/google/start"
            className="flex items-center justify-center gap-2 rounded-xl border border-gold/60 px-4 py-2 text-sm font-semibold text-card hover:bg-white/5"
          >
            Continue with Google
          </a>
        </>
      )}
    </div>
  )
}

function VerifyBanner() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const resend = async () => {
    setState('sending')
    await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }).catch(() => {})
    setState('sent')
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm text-card/85">
      <span>Your email isn’t confirmed yet — check your inbox for the link.</span>
      {state === 'sent' ? (
        <span className="text-card/60">Sent. Give it a minute.</span>
      ) : (
        <button
          type="button"
          onClick={() => void resend()}
          disabled={state === 'sending'}
          className="self-start font-semibold text-gold hover:underline disabled:opacity-50"
        >
          {state === 'sending' ? 'Sending…' : 'Resend confirmation email'}
        </button>
      )}
    </div>
  )
}

function SignedIn() {
  const { user, mailEnabled, updateAccount, logout } = useAuth()
  const [name, setName] = useState(user?.displayName ?? '')
  const [savingName, setSavingName] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (!user) return null
  const nameDirty = name.trim() !== user.displayName

  const saveName = async () => {
    setSavingName(true)
    setMsg(null)
    const res = await updateAccount({ displayName: name.trim() })
    setSavingName(false)
    setMsg(res.ok ? 'Saved.' : (res.error ?? 'Could not save.'))
  }

  const toggleAutoPost = async () => {
    setMsg(null)
    const res = await updateAccount({ autoPost: !user.autoPost })
    if (!res.ok) setMsg(res.error ?? 'Could not save.')
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      {mailEnabled && !user.emailVerified && <VerifyBanner />}

      <div className="rounded-xl border border-gold/30 bg-black/20 p-4">
        <p className="text-xs uppercase tracking-widest text-gold/80">Signed in as</p>
        <p className="text-card">{user.email}</p>
        <p className="mt-1 text-xs text-card/50">
          {user.hasPassword && user.hasGoogle
            ? 'Email/password and Google both linked.'
            : user.hasGoogle
              ? 'Google account.'
              : 'Email/password account.'}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs uppercase tracking-widest text-gold/80">Display name</label>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX}
            className="min-w-0 flex-1 rounded-lg border border-gold/40 bg-felt px-3 py-2 text-sm text-card focus:border-gold focus:outline-none"
          />
          <Button variant="gold" onClick={() => void saveName()} disabled={!nameDirty || savingName}>
            Save
          </Button>
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-gold/30 bg-black/20 p-4">
        <input
          type="checkbox"
          checked={user.autoPost}
          onChange={() => void toggleAutoPost()}
          className="mt-1 h-4 w-4 accent-gold"
        />
        <span className="text-sm text-card/85">
          <span className="font-semibold text-card">Auto-post scores to the leaderboard.</span> When a
          finished game qualifies, post it automatically under your display name instead of typing a
          name each time.
        </span>
      </label>

      {msg && <p className="text-sm text-card/70">{msg}</p>}

      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-widest text-gold/80">Recent games</p>
        <History />
      </div>

      <Button variant="ghost" onClick={() => void logout()}>
        Sign out
      </Button>
    </div>
  )
}

export function Account() {
  const { user, loading, configured } = useAuth()

  return (
    <Layout title="Account">
      {loading ? (
        <Loading label="Checking your session…" />
      ) : !configured ? (
        <p className="mx-auto max-w-sm text-center text-card/70">
          Accounts aren’t configured on this deployment.
        </p>
      ) : user ? (
        <SignedIn />
      ) : (
        <SignedOut />
      )}
    </Layout>
  )
}
