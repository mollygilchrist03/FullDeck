import type { GridSize } from '../memoryReducer'
import { PAIRS_FOR } from '../memoryReducer'

interface DifficultySelectorProps {
  value: GridSize
  onChange: (size: GridSize) => void
  disabled?: boolean
}

const OPTIONS: { size: GridSize; label: string }[] = [
  { size: 4, label: 'Easy' },
  { size: 6, label: 'Hard' },
]

export function DifficultySelector({ value, onChange, disabled = false }: DifficultySelectorProps) {
  return (
    <div className="inline-flex rounded-xl border border-gold/40 bg-black/20 p-1">
      {OPTIONS.map(({ size, label }) => (
        <button
          key={size}
          type="button"
          disabled={disabled}
          onClick={() => onChange(size)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40 ${
            value === size ? 'bg-gold text-ink' : 'text-card/80 hover:text-card'
          }`}
        >
          {label}
          <span className="ml-1 text-xs opacity-70">
            {size}×{size} · {PAIRS_FOR[size]} pairs
          </span>
        </button>
      ))}
    </div>
  )
}
