import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface LayoutProps {
  /** Shown in the top bar; omit on the hub. */
  title?: string
  /** Right-hand slot — typically a "New Game" button. */
  action?: ReactNode
  children: ReactNode
}

export function Layout({ title, action, children }: LayoutProps) {
  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col px-4 pb-28 pt-4 sm:pb-8">
      <header className="mb-4 flex items-center justify-between gap-3">
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
        {action}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
