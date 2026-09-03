import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

interface LayoutProps {
  /** Shown in the top bar; omit on the hub. */
  title?: string
  /** Right-hand slot — typically a "New Game" button. */
  action?: ReactNode
  children: ReactNode
}

export function Layout({ title, action, children }: LayoutProps) {
  const onLeaderboard = useLocation().pathname === '/leaderboard'

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
          {!onLeaderboard && (
            <Link
              to="/leaderboard"
              className="rounded-lg border border-gold/50 px-3 py-1.5 text-sm font-semibold text-gold hover:bg-white/5"
              aria-label="Leaderboard"
            >
              🏆<span className="ml-1 hidden sm:inline">Leaderboard</span>
            </Link>
          )}
          {action}
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
