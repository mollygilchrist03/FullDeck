import { Card } from '../../../components/Card'
import type { GridSize } from '../memoryReducer'
import type { Tile } from '../memoryLogic'

interface GridProps {
  tiles: Tile[]
  gridSize: GridSize
  flipped: number[]
  matched: number[]
  justMatched: number[]
  lock: boolean
  onFlip: (id: number) => void
}

export function Grid({
  tiles,
  gridSize,
  flipped,
  matched,
  justMatched,
  lock,
  onFlip,
}: GridProps) {
  return (
    <div className="overflow-x-auto">
      <div
        className="mx-auto grid gap-2 sm:gap-3"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
          maxWidth: gridSize === 4 ? '28rem' : '42rem',
        }}
      >
        {tiles.map((tile) => {
          const isUp = flipped.includes(tile.id) || matched.includes(tile.id)
          const isMatched = matched.includes(tile.id)
          return (
            <Card
              key={tile.id}
              card={{ code: tile.code, image: tile.image, rank: 'ACE', suit: 'SPADES' }}
              faceDown={!isUp}
              pulse={justMatched.includes(tile.id)}
              disabled={lock || isUp}
              onClick={() => onFlip(tile.id)}
              label={isUp ? `Card ${tile.code}` : 'Face-down card'}
              className={isMatched ? 'opacity-70' : ''}
            />
          )
        })}
      </div>
    </div>
  )
}
