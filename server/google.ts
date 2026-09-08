/**
 * Google sign-in — a manual OAuth 2.0 authorization-code flow with PKCE, run
 * server-side as a confidential client. Needs GOOGLE_CLIENT_ID and
 * GOOGLE_CLIENT_SECRET in the environment (and the callback URL registered in
 * the Google Cloud console). Without them the "Sign in with Google" path just
 * reports it isn't configured.
 */
import { createHash, randomBytes } from 'node:crypto'

export const OAUTH_TX_COOKIE = 'fd_oauth'

type Headers = Record<string, string | string[] | undefined>

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function makePkce(): { verifier: string; challenge: string; state: string } {
  const verifier = randomBytes(48).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const state = randomBytes(24).toString('base64url')
  return { verifier, challenge, state }
}

export function txCookie(value: string): string {
  return `${OAUTH_TX_COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=600`
}
export function clearTxCookie(): string {
  return `${OAUTH_TX_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=0`
}

export function readTxCookie(cookieHeader: string | undefined): { state: string; verifier: string } | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [k, v] = part.split('=')
    if (k?.trim() === OAUTH_TX_COOKIE && v) {
      const dot = v.indexOf('.')
      if (dot < 0) return null
      return { state: v.slice(0, dot), verifier: v.slice(dot + 1) }
    }
  }
  return null
}

export function redirectUri(headers: Headers): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI
  const host = headers['x-forwarded-host'] ?? headers.host
  return `https://${String(host)}/api/auth/google/callback`
}

export function authUrl(opts: { redirectUri: string; state: string; challenge: string }): string {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  u.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!)
  u.searchParams.set('redirect_uri', opts.redirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', 'openid email profile')
  u.searchParams.set('state', opts.state)
  u.searchParams.set('code_challenge', opts.challenge)
  u.searchParams.set('code_challenge_method', 'S256')
  u.searchParams.set('access_type', 'online')
  u.searchParams.set('prompt', 'select_account')
  return u.toString()
}

export interface GoogleIdentity {
  sub: string
  email: string
  name: string
}

export async function exchangeCode(opts: {
  code: string
  verifier: string
  redirectUri: string
}): Promise<GoogleIdentity> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: opts.code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: opts.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: opts.verifier,
    }),
  })
  if (!res.ok) throw new Error(`google token exchange failed: ${res.status}`)
  const data = (await res.json()) as { id_token?: string }
  if (!data.id_token) throw new Error('no id_token in google token response')

  // The id_token arrived straight from Google's token endpoint over TLS, in
  // response to a request authenticated with our client secret — its
  // provenance is already established, so we read the claims directly rather
  // than round-tripping a JWKS signature check.
  const payload = JSON.parse(
    Buffer.from(data.id_token.split('.')[1], 'base64url').toString('utf8'),
  ) as { sub: string; email: string; name?: string }

  return {
    sub: payload.sub,
    email: String(payload.email).toLowerCase(),
    name: payload.name ?? String(payload.email).split('@')[0],
  }
}
