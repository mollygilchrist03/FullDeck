interface LoadingProps {
  label?: string
}

/** Non-blocking deck-fetch indicator: three shimmering card backs. */
export function Loading({ label = 'Shuffling the deck…' }: LoadingProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-10" role="status" aria-live="polite">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 w-14 rounded-md border-2 border-gold/70 bg-felt animate-pulse"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
      <p className="text-sm text-card/80">{label}</p>
    </div>
  )
}

interface ErrorNoticeProps {
  message: string
  onRetry?: () => void
}

export function ErrorNotice({ message, onRetry }: ErrorNoticeProps) {
  return (
    <div className="mx-auto max-w-sm rounded-xl border border-casino/60 bg-casino/10 p-4 text-center">
      <p className="text-sm text-card">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-casino px-4 py-2 text-sm font-semibold text-card"
        >
          Try again
        </button>
      )}
    </div>
  )
}
