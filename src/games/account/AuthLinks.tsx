import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { Button } from '../../components/Button'
import { Spinner } from '../../components/Loading'
import { useAuth } from '../../hooks/authContext'
import { PASSWORD_MIN, passwordProblem } from '../../lib/auth'

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new Error((data.error as string) ?? 'Something went wrong.')
  return data
}

const backToAccount = (
  <Link to="/account" className="text-sm font-semibold text-gold hover:underline">
    Back to your account
  </Link>
)

/** Landing page for the email-confirmation link. */
export function VerifyEmail() {
  const [params] = useSearchParams()
  const { refresh } = useAuth()
  const [state, setState] = useState<'working' | 'ok' | 'bad'>('working')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setState('bad')
      setMessage('That link is missing its token.')
      return
    }
    post('/api/auth/verify-email', { token })
      .then(() => {
        setState('ok')
        void refresh()
      })
      .catch((e: Error) => {
        setState('bad')
        setMessage(e.message)
      })
  }, [params, refresh])

  return (
    <Layout title="Confirm email">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 text-center">
        {state === 'working' && (
          <p className="flex items-center gap-2 text-card/75">
            <Spinner className="h-4 w-4" /> Confirming…
          </p>
        )}
        {state === 'ok' && (
          <>
            <p className="font-display text-xl text-gold">Email confirmed.</p>
            {backToAccount}
          </>
        )}
        {state === 'bad' && (
          <>
            <p className="text-casino">{message}</p>
            {backToAccount}
          </>
        )}
      </div>
    </Layout>
  )
}

/** Landing page for the password-reset link — set a new password. */
export function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const problem = passwordProblem(password)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await post('/api/auth/reset-password', { token, password })
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reset your password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout title="Reset password">
      <div className="mx-auto flex max-w-sm flex-col gap-4">
        {done ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="font-display text-xl text-gold">Password updated.</p>
            <p className="text-sm text-card/70">
              Every session was signed out — sign in again with your new password.
            </p>
            {backToAccount}
          </div>
        ) : !token ? (
          <p className="text-center text-casino">That link is missing its token.</p>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-gold/80">
              New password
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-gold/40 bg-felt px-3 py-2 text-sm text-card focus:border-gold focus:outline-none"
                onKeyDown={(e) => e.key === 'Enter' && void submit()}
              />
              <span className="text-[0.7rem] normal-case tracking-normal text-card/50">
                At least {PASSWORD_MIN} characters.
              </span>
            </label>
            <Button variant="gold" onClick={() => void submit()} disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : 'Set new password'}
            </Button>
            {error && <p className="text-sm text-casino">{error}</p>}
          </>
        )}
      </div>
    </Layout>
  )
}
