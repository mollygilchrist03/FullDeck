import { isMatch, isWin, type Tile } from './memoryLogic'

export type GridSize = 4 | 6
export type MemoryStatus = 'idle' | 'playing' | 'won'

export const PAIRS_FOR: Record<GridSize, number> = { 4: 8, 6: 18 }

export interface MemoryState {
  gridSize: GridSize
  tiles: Tile[]
  /** Ids currently face-up and not yet matched (0, 1, or 2). */
  flipped: number[]
  /** Ids that have been matched and stay face-up. */
  matched: number[]
  moves: number
  /** True while a mismatched pair is shown — blocks further flips. */
  lock: boolean
  status: MemoryStatus
  /** Ids to briefly pulse after a successful match. */
  justMatched: number[]
}

export type MemoryAction =
  | { type: 'SET_DIFFICULTY'; size: GridSize }
  | { type: 'START'; tiles: Tile[] }
  | { type: 'FLIP'; id: number }
  | { type: 'RESOLVE' }
  | { type: 'CLEAR_PULSE' }

export function initMemory(gridSize: GridSize = 4): MemoryState {
  return {
    gridSize,
    tiles: [],
    flipped: [],
    matched: [],
    moves: 0,
    lock: false,
    status: 'idle',
    justMatched: [],
  }
}

export function memoryReducer(state: MemoryState, action: MemoryAction): MemoryState {
  switch (action.type) {
    case 'SET_DIFFICULTY': {
      // The container reacts to this by dealing a fresh board.
      return { ...initMemory(action.size) }
    }

    case 'START': {
      return {
        ...initMemory(state.gridSize),
        tiles: action.tiles,
        status: 'playing',
      }
    }

    case 'FLIP': {
      if (state.status !== 'playing' || state.lock) return state
      if (state.flipped.includes(action.id) || state.matched.includes(action.id)) return state

      const flipped = [...state.flipped, action.id]
      if (flipped.length < 2) {
        return { ...state, flipped }
      }

      // Second card of the turn.
      const [firstId, secondId] = flipped
      const first = state.tiles.find((t) => t.id === firstId)!
      const second = state.tiles.find((t) => t.id === secondId)!
      const moves = state.moves + 1

      if (isMatch(first, second)) {
        const matched = [...state.matched, firstId, secondId]
        return {
          ...state,
          flipped: [],
          matched,
          moves,
          justMatched: [firstId, secondId],
          status: isWin(matched.length, state.tiles.length) ? 'won' : 'playing',
        }
      }

      // Mismatch — keep both showing and lock until RESOLVE.
      return { ...state, flipped, moves, lock: true }
    }

    case 'RESOLVE': {
      if (!state.lock) return state
      return { ...state, flipped: [], lock: false }
    }

    case 'CLEAR_PULSE': {
      return state.justMatched.length ? { ...state, justMatched: [] } : state
    }

    default:
      return state
  }
}
