import type { ReactNode } from 'react'

interface GameRulesProps {
  children: ReactNode
}

/** Collapsible "How to play" panel for a game screen. Closed by default. */
export function GameRules({ children }: GameRulesProps) {
  return (
    <details className="rounded-xl border border-gold/30 bg-black/20 text-card/85 [&_strong]:text-card">
      <summary className="cursor-pointer list-none px-4 py-2 text-sm font-semibold text-gold/90 marker:content-none">
        <span className="mr-1">▸</span>How to play
      </summary>
      <div className="space-y-2 px-4 pb-4 pt-1 text-sm leading-relaxed">{children}</div>
    </details>
  )
}
