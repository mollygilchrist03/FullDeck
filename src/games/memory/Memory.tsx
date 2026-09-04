import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Layout } from '../../components/Layout'
import { Button } from '../../components/Button'
import { Loading, ErrorNotice } from '../../components/Loading'
import { useDeck } from '../../hooks/useDeck'
import { buildBoard } from './memoryLogic'
import {
  initMemory,
  memoryReducer,
  PAIRS_FOR,
  type GridSize,
} from './memoryReducer'
import { Grid } from './components/Grid'
import { Hud } from './components/Hud'
import { DifficultySelector } from './components/DifficultySelector'
import { CompletionScreen } from './components/CompletionScreen'
import { ScoreSubmit } from '../../components/ScoreSubmit'
import { GameRules } from '../../components/GameRules'

const MISMATCH_DELAY = 900
const PULSE_DELAY = 600

export function Memory() {
  const deck = useDeck()
  const [state, dispatch] = useReducer(memoryReducer, undefined, () => initMemory(4))
  const [dealing, setDealing] = useState(true)
  const [elapsedMs, setElapsedMs] = useState(0)
  const startAtRef = useRef<number | null>(null)
  const didInit = useRef(false)

  const { reshuffleAndDraw } = deck

  const deal = useCallback(
    async (size: GridSize) => {
      setDealing(true)
      try {
        const cards = await reshuffleAndDraw(PAIRS_FOR[size])
        dispatch({ type: 'START', tiles: buildBoard(cards, PAIRS_FOR[size]) })
        startAtRef.current = performance.now()
        setElapsedMs(0)
      } catch {
        /* surfaced via deck.error */
      } finally {
        setDealing(false)
      }
    },
    [reshuffleAndDraw],
  )

  // First deal (guard against React StrictMode's double-invoke).
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    void deal(4)
  }, [deal])

  // Flip mismatched cards back after a beat.
  useEffect(() => {
    if (!state.lock) return
    const t = setTimeout(() => dispatch({ type: 'RESOLVE' }), MISMATCH_DELAY)
    return () => clearTimeout(t)
  }, [state.lock])

  // Clear the match pulse.
  useEffect(() => {
    if (state.justMatched.length === 0) return
    const t = setTimeout(() => dispatch({ type: 'CLEAR_PULSE' }), PULSE_DELAY)
    return () => clearTimeout(t)
  }, [state.justMatched])

  // Running timer while playing.
  useEffect(() => {
    if (state.status !== 'playing' || startAtRef.current === null) return
    const id = setInterval(() => {
      if (startAtRef.current !== null) setElapsedMs(performance.now() - startAtRef.current)
    }, 200)
    return () => clearInterval(id)
  }, [state.status])

  const changeDifficulty = useCallback(
    (size: GridSize) => {
      if (size === state.gridSize) return
      dispatch({ type: 'SET_DIFFICULTY', size })
      void deal(size)
    },
    [state.gridSize, deal],
  )

  const totalTiles = state.tiles.length
  const showBoard = state.status !== 'idle' && !dealing

  return (
    <Layout
      title="Memory Match"
      action={
        <Button variant="gold" onClick={() => void deal(state.gridSize)} disabled={dealing}>
          New game
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <GameRules>
          <p>Every card has a twin. Flip two cards a turn: if their ranks match they stay face up; if not, the board locks for a moment and they flip back.</p>
          <p>Clear every pair to win. A lower move count and a faster time are better. Pick a 4×4 board (8 pairs) or 6×6 (18 pairs) — only 6×6 times go on the leaderboard.</p>
        </GameRules>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <DifficultySelector value={state.gridSize} onChange={changeDifficulty} disabled={dealing} />
          <p className="text-xs text-card/60">{deck.remaining} cards left</p>
        </div>

        {deck.error && (
          <ErrorNotice message={deck.error} onRetry={() => void deal(state.gridSize)} />
        )}

        {showBoard && (
          <Hud
            moves={state.moves}
            elapsedMs={elapsedMs}
            matched={state.matched.length}
            total={totalTiles}
          />
        )}

        {dealing ? (
          <Loading label="Dealing a fresh board…" />
        ) : state.status === 'won' ? (
          <>
            <CompletionScreen
              moves={state.moves}
              elapsedMs={elapsedMs}
              onPlayAgain={() => void deal(state.gridSize)}
            />
            {state.gridSize === 6 ? (
              <div className="mx-auto">
                <ScoreSubmit game="memory" score={Math.max(1, Math.round(elapsedMs / 1000))} />
              </div>
            ) : (
              <p className="text-center text-xs text-card/60">
                Clear the 6×6 board to post a time to the leaderboard.
              </p>
            )}
            <div className="pointer-events-none opacity-50">
              <Grid
                tiles={state.tiles}
                gridSize={state.gridSize}
                flipped={state.flipped}
                matched={state.matched}
                justMatched={[]}
                lock
                onFlip={() => {}}
              />
            </div>
          </>
        ) : (
          <Grid
            tiles={state.tiles}
            gridSize={state.gridSize}
            flipped={state.flipped}
            matched={state.matched}
            justMatched={state.justMatched}
            lock={state.lock}
            onFlip={(id) => dispatch({ type: 'FLIP', id })}
          />
        )}
      </div>
    </Layout>
  )
}
