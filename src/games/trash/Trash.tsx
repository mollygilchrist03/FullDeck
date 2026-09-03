import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Layout } from '../../components/Layout'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Loading, ErrorNotice } from '../../components/Loading'
import { GameRules } from '../../components/GameRules'
import { ScoreSubmit } from '../../components/ScoreSubmit'
import { useDeck } from '../../hooks/useDeck'
import { initTrash, trashReducer, type Slot } from './trashReducer'

const AI_STEP_MS = 850

function Row({
  slots,
  label,
  onPick,
}: {
  slots: Slot[]
  label: string
  onPick?: (i: number) => void
}) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-widest text-gold/80">{label}</p>
      <div className="flex flex-wrap gap-x-1 gap-y-4 pt-1">
        {slots.map((s, i) => (
          <div key={i} className="relative w-9 sm:w-12">
            <span className="absolute -top-3.5 left-0 right-0 text-center text-[0.6rem] text-card/40">
              {i + 1}
            </span>
            <Card
              card={s.locked ?? { code: 'x', image: '', rank: 'ACE', suit: 'SPADES' }}
              faceDown={!s.locked}
              onClick={onPick && !s.locked ? () => onPick(i) : undefined}
              disabled={!onPick || !!s.locked}
              className={onPick && !s.locked ? 'ring-2 ring-gold' : ''}
              label={s.locked ? undefined : `Slot ${i + 1}`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function Trash() {
  const deck = useDeck()
  const [state, dispatch] = useReducer(trashReducer, undefined, initTrash)
  const [dealing, setDealing] = useState(true)
  const didInit = useRef(false)

  const { startNewDeck, drawCards } = deck

  const dealRound = useCallback(
    async (playerN: number, aiN: number, next: boolean) => {
      setDealing(true)
      try {
        await startNewDeck()
        const c = await drawCards(52)
        const playerFaceDown = c.slice(0, playerN)
        const aiFaceDown = c.slice(playerN, playerN + aiN)
        const stock = c.slice(playerN + aiN)
        dispatch(
          next
            ? { type: 'NEXT_ROUND', stock, playerFaceDown, aiFaceDown }
            : { type: 'START', stock, playerFaceDown, aiFaceDown },
        )
      } catch {
        /* surfaced via deck.error */
      } finally {
        setDealing(false)
      }
    },
    [startNewDeck, drawCards],
  )

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    void dealRound(10, 10, false)
  }, [dealRound])

  useEffect(() => {
    if (state.phase !== 'aiTurn') return
    const id = setTimeout(() => dispatch({ type: 'AI_STEP' }), AI_STEP_MS)
    return () => clearTimeout(id)
  }, [state.phase, state.aiSteps])

  const nextRound = () => {
    const pN = state.roundWinner === 'player' ? state.playerSize - 1 : state.playerSize
    const aN = state.roundWinner === 'ai' ? state.aiSize - 1 : state.aiSize
    void dealRound(pN, aN, true)
  }

  const myTurn = state.phase === 'playerTurn'
  const discardTop = state.discard[state.discard.length - 1]
  const over = state.phase === 'gameover'

  return (
    <Layout
      title="Trash"
      action={
        <Button variant="gold" onClick={() => void dealRound(10, 10, false)} disabled={dealing}>
          New game
        </Button>
      }
    >
      {deck.error && (
        <div className="mb-4">
          <ErrorNotice message={deck.error} onRetry={() => void dealRound(10, 10, false)} />
        </div>
      )}

      <div className="mb-4">
        <GameRules>
          <p>Fill your row of face-down cards with Ace → 10 in order. Each turn, draw from the stock (or take the discard) and slot the card into its matching position, swapping up whatever was there — then play that card, and so on until you're stuck.</p>
          <p><strong>Queens are wild</strong> (any open slot). Jacks and Kings are dead — they end your turn. Clear your whole row to win the round; the winner lays one fewer card next round. Win a round with a single-card row to take the match.</p>
          <p>Fewest turns to the match win is your score.</p>
        </GameRules>
      </div>

      {dealing ? (
        <Loading label="Laying out the rows…" />
      ) : (
        <div className="flex flex-col items-center gap-4">
          <p className="text-xs text-card/60">
            Round {state.round} · turns {state.playerTurns}
          </p>

          <Row slots={state.aiSlots} label={`Dealer — lays ${state.aiSize}`} />

          <div className="flex items-end gap-4">
            <div className="flex flex-col items-center gap-1">
              <div className="w-14 sm:w-16">
                <Card faceDown />
              </div>
              <span className="text-[0.7rem] text-card/60">stock {state.stock.length}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-14 sm:w-16">
                {discardTop ? (
                  <Card card={discardTop} faceDown={false} />
                ) : (
                  <div className="aspect-[5/7] w-full rounded-[0.55rem] border border-dashed border-card/25" />
                )}
              </div>
              <span className="text-[0.7rem] text-card/60">discard</span>
            </div>
            {state.held && (
              <div className="flex flex-col items-center gap-1">
                <div className="w-14 animate-deal sm:w-16">
                  <Card card={state.held} faceDown={false} />
                </div>
                <span className="text-[0.7rem] text-gold">in hand</span>
              </div>
            )}
          </div>

          <Row
            slots={state.playerSlots}
            label={`You — lay ${state.playerSize}`}
            onPick={state.phase === 'wildChoice' ? (i) => dispatch({ type: 'PLACE_WILD', slot: i }) : undefined}
          />

          <p className="min-h-5 max-w-md text-center text-sm text-card/75" role="status" aria-live="polite">
            {state.phase === 'wildChoice' ? 'Queen is wild — tap an open slot.' : state.log[state.log.length - 1]}
          </p>

          {state.phase === 'roundOver' && (
            <Button size="lg" variant="gold" onClick={nextRound}>
              Next round
            </Button>
          )}

          {myTurn && (
            <div className="flex gap-3">
              <Button size="lg" variant="accent" onClick={() => dispatch({ type: 'DRAW' })}>
                Draw
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => dispatch({ type: 'TAKE_DISCARD' })}
                disabled={!discardTop}
              >
                Take discard
              </Button>
            </div>
          )}

          {over && (
            <div className="flex flex-col items-center gap-3">
              <p className="font-display text-xl text-gold">
                {state.matchWinner === 'player' ? 'You win the match!' : 'The dealer wins the match.'}
              </p>
              {state.matchWinner === 'player' && (
                <ScoreSubmit game="trash" score={state.playerTurns} />
              )}
              <Button size="lg" variant="gold" onClick={() => void dealRound(10, 10, false)}>
                Play again
              </Button>
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}
