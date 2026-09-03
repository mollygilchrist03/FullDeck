import { Button } from '../../../components/Button'
import { formatTime } from './Hud'

interface CompletionScreenProps {
  moves: number
  elapsedMs: number
  onPlayAgain: () => void
}

export function CompletionScreen({ moves, elapsedMs, onPlayAgain }: CompletionScreenProps) {
  return (
    <div className="animate-deal mx-auto flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-gold bg-gold/10 p-6 text-center">
      <p className="text-4xl">🏆</p>
      <h2 className="font-display text-2xl font-bold text-gold">Board cleared!</h2>
      <div className="flex gap-8">
        <div>
          <p className="text-[0.65rem] uppercase tracking-widest text-gold/80">Moves</p>
          <p className="text-2xl font-bold tabular-nums text-card">{moves}</p>
        </div>
        <div>
          <p className="text-[0.65rem] uppercase tracking-widest text-gold/80">Time</p>
          <p className="text-2xl font-bold tabular-nums text-card">{formatTime(elapsedMs)}</p>
        </div>
      </div>
      <Button variant="gold" size="lg" onClick={onPlayAgain} className="w-full">
        Play again
      </Button>
    </div>
  )
}
