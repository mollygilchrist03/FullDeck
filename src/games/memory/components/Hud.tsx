export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface HudProps {
  moves: number
  elapsedMs: number
  matched: number
  total: number
}

export function Hud({ moves, elapsedMs, matched, total }: HudProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gold/40 bg-black/20 px-4 py-2 text-sm">
      <Stat label="Moves" value={moves} />
      <Stat label="Pairs" value={`${matched / 2}/${total / 2}`} />
      <Stat label="Time" value={formatTime(elapsedMs)} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="text-[0.65rem] uppercase tracking-widest text-gold/80">{label}</p>
      <p className="font-bold tabular-nums text-card">{value}</p>
    </div>
  )
}
