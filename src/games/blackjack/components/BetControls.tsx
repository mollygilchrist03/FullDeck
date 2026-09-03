import { Button } from '../../../components/Button'
import { CHIP_DENOMINATIONS } from '../blackjackReducer'

interface BetControlsProps {
  bank: number
  bet: number
  onChangeBet: (amount: number) => void
  onDeal: () => void
  disabled?: boolean
}

export function BetControls({ bank, bet, onChangeBet, onDeal, disabled = false }: BetControlsProps) {
  const canDeal = bet > 0 && bet <= bank && !disabled

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-card/75">Place your bet</p>

      <div className="flex flex-wrap justify-center gap-2">
        {CHIP_DENOMINATIONS.map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={disabled || bet + chip > bank}
            onClick={() => onChangeBet(bet + chip)}
            className="h-14 w-14 rounded-full border-4 border-dashed border-card/70 bg-casino text-sm font-bold text-card shadow-lg shadow-black/40 transition-transform active:scale-95 disabled:opacity-30"
          >
            +{chip}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled || bet === 0}
          onClick={() => onChangeBet(0)}
          className="h-14 rounded-full border border-gold/50 px-4 text-sm font-semibold text-card disabled:opacity-30"
        >
          Clear
        </button>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => onChangeBet(Math.floor(bet / 2))} disabled={disabled || bet === 0}>
          ½
        </Button>
        <span className="min-w-24 text-center text-2xl font-bold tabular-nums text-gold">${bet}</span>
        <Button variant="ghost" onClick={() => onChangeBet(bank)} disabled={disabled || bet === bank}>
          Max
        </Button>
      </div>

      <Button size="lg" variant="gold" onClick={onDeal} disabled={!canDeal} className="w-full max-w-xs">
        Deal
      </Button>
    </div>
  )
}
