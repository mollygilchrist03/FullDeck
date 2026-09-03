import { OUTCOME_MESSAGE, type Outcome } from '../outcome'

interface ResultBannerProps {
  result: Outcome
  payout: number
}

const TONE: Record<Outcome, string> = {
  blackjack: 'border-gold bg-gold/15 text-gold',
  win: 'border-gold bg-gold/15 text-gold',
  push: 'border-card/40 bg-black/20 text-card',
  loss: 'border-casino bg-casino/15 text-casino',
}

export function ResultBanner({ result, payout }: ResultBannerProps) {
  const sign = payout > 0 ? `+$${payout}` : payout < 0 ? `-$${Math.abs(payout)}` : 'even'
  return (
    <div
      className={`animate-deal rounded-xl border px-5 py-3 text-center ${TONE[result]}`}
      role="status"
      aria-live="polite"
    >
      <p className="font-display text-xl font-bold">{OUTCOME_MESSAGE[result]}</p>
      <p className="text-sm font-semibold tabular-nums">{sign}</p>
    </div>
  )
}
