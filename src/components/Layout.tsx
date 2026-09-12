import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMuted } from '../hooks/useMuted.js'
import { toggleMuted } from '../lib/soundSettings.js'
import { useAuth } from '../hooks/authContext.js'
import { useVisitCount } from '../hooks/useVisitCount.js'
import { Icon } from './Icon.js'

const NAV_LINK =
  'inline-flex items-center gap-1.5 rounded-lg border border-gold/50 px-3 py-1.5 text-sm font-semibold text-gold hover:bg-white/5'

interface LayoutProps {
  /** Shown in the top bar; omit on the hub. */
  title?: string
  /** Right-hand slot — typically a "New Game" button. */
  action?: ReactNode
  children: ReactNode
}

export function Layout({ title, action, children }: LayoutProps) {
  const path = useLocation().pathname
  const onLeaderboard = path === '/leaderboard'
  const onMultiplayer = path === '/multiplayer' || path.startsWith('/room/')
  const onAccount = path === '/account'
  const muted = useMuted()
  const { user } = useAuth()
  const visits = useVisitCount()

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col px-4 pb-36 pt-4 sm:pb-8">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-y-2 gap-x-3">
        <div className="flex items-center gap-3">
          {title ? (
            <Link
              to="/"
              className="rounded-lg border border-gold/50 px-3 py-1.5 text-sm text-card hover:bg-white/5"
            >
              ← Hub
            </Link>
          ) : (
            <span className="font-display text-xl font-bold tracking-wide text-gold">Full Deck</span>
          )}
          {title && <h1 className="font-display text-lg font-bold text-card">{title}</h1>}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMuted}
            className={NAV_LINK}
            aria-label={muted ? 'Unmute sound and haptics' : 'Mute sound and haptics'}
            aria-pressed={muted}
          >
            <Icon name={muted ? 'volume-mute' : 'volume-up'} />
          </button>
          {!onMultiplayer && (
            <Link to="/multiplayer" className={NAV_LINK} aria-label="Play with a friend">
              <Icon name="people" />
              <span className="hidden sm:inline">Friend</span>
            </Link>
          )}
          {!onLeaderboard && (
            <Link to="/leaderboard" className={NAV_LINK} aria-label="Leaderboard">
              <Icon name="trophy" />
              <span className="hidden sm:inline">Leaderboard</span>
            </Link>
          )}
          {!onAccount && (
            <Link
              to="/account"
              className={`${NAV_LINK} max-w-[9rem]`}
              aria-label={user ? 'Your account' : 'Sign in'}
            >
              <Icon name={user ? 'person-circle' : 'person-add'} />
              <span className="hidden truncate sm:inline">
                {user ? user.displayName : 'Sign in'}
              </span>
            </Link>
          )}
          {action}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-8 text-center text-xs text-card/40">
        {visits != null && <p>{visits.toLocaleString()} visits</p>}
      </footer>
    </div>
  )
}
