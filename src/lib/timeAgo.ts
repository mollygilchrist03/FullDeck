const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
]

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "3 days ago", "just now" — from an ISO timestamp. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return 'just now'
  for (const [unit, secs] of STEPS) {
    if (abs >= secs) return rtf.format(Math.round(seconds / secs), unit)
  }
  return 'just now'
}
