import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { Button } from '../../components/Button'
import { Loading } from '../../components/Loading'
import { useAuth } from '../../hooks/authContext'
import { NAME_MAX } from '../../lib/leaderboard'
import { PASSWORD_MIN } from '../../lib/auth'

function SignedOut() {
  const { register, login, googleEnabled } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [params] = useSearchParams()

  useEffect(() => {
    if (params.get('error') === 'google') setError('Google sign-in didn’t complete. Try again.')
  }, [params])

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
          {busy ? '…' : mode === 'register' ? 'Create account' : 'Sign in'}
        </Button>
        {error && <p className="text-sm text-casino">{error}</p>}
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

function SignedIn() {
  const { user, updateAccount, logout } = useAuth()
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
