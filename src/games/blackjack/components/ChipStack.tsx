interface ChipStackProps {
  bank: number
  bet: number
}

export function ChipStack({ bank, bet }: ChipStackProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gold/40 bg-black/20 px-4 py-2">
      <div>
        <p className="text-[0.65rem] uppercase tracking-widest text-gold/80">Bank</p>
        <p className="text-lg font-bold tabular-nums text-card">${bank}</p>
      </div>
      <div className="h-8 w-px bg-gold/30" />
      <div>
        <p className="text-[0.65rem] uppercase tracking-widest text-gold/80">Bet</p>
        <p className="text-lg font-bold tabular-nums text-casino">${bet}</p>
      </div>
    </div>
  )
}
