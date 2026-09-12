import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Layout } from '../../components/Layout.js'
import { Button } from '../../components/Button.js'
import { Card } from '../../components/Card.js'
import { Loading, ErrorNotice } from '../../components/Loading.js'
import { GameRules } from '../../components/GameRules.js'
import { ScoreSubmit } from '../../components/ScoreSubmit.js'
import { useDeck } from '../../hooks/useDeck.js'
import { feedback } from '../../lib/feedback.js'
import { useRecordGameOnce } from '../../hooks/useRecordGame.js'
import { SEAT_RANGE } from '../../lib/multiplayer.js'
import type { Card as CardData } from '../../types/card.js'
import { initTrash, trashReducer, type Slot } from './trashReducer.js'

const AI_STEP_MS = 850
const YOU = 0
const MIN_SEATS = 2
const MAX_SEATS = SEAT_RANGE.trash.max
const ROW_SIZE = 10

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
  const [seatCount, setSeatCount] = useState(2)
  const [started, setStarted] = useState(false)
  const [state, dispatch] = useReducer(trashReducer, 2, initTrash)
  const [dealing, setDealing] = useState(false)
  const didInit = useRef(false)

  const { startNewDeck, drawCards } = deck

  const dealRound = useCallback(
    async (sizes: number[], next: boolean) => {
      setDealing(true)
      try {
        await startNewDeck()
        const c = await drawCards(52)
        const faceDown: CardData[][] = []
        let at = 0
        for (const size of sizes) {
          faceDown.push(c.slice(at, at + size))
          at += size
        }
        const stock = c.slice(at)
        feedback('deal')
        dispatch(next ? { type: 'NEXT_ROUND', stock, faceDown } : { type: 'START', stock, faceDown })
      } catch {
        /* surfaced via deck.error */
      } finally {
        setDealing(false)
      }
    },
    [startNewDeck, drawCards],
  )

  useEffect(() => {
    if (!started || didInit.current) return
    didInit.current = true
    void dealRound(Array(seatCount).fill(ROW_SIZE), false)
  }, [started, dealRound, seatCount])

  // Whichever AI seat's turn it is draws.
  useEffect(() => {
    if (state.phase !== 'turn' || state.turn === YOU) return
    const id = setTimeout(() => {
      feedback('flip')
      dispatch({ type: 'AI_STEP' })
    }, AI_STEP_MS)
    return () => clearTimeout(id)
  }, [state.phase, state.turn, state.aiSteps])

  useEffect(() => {
    if (state.phase === 'gameover') feedback(state.matchWinner === YOU ? 'win' : 'lose')
  }, [state.phase, state.matchWinner])

  useRecordGameOnce({
    terminal: state.phase === 'gameover',
    game: 'trash',
    score: state.turnsTaken,
    detail:
      state.matchWinner === YOU
        ? `Won the match in ${state.turnsTaken} turns`
        : 'Lost the match',
  })

  const nextRound = () => {
    const sizes = state.sizes.map((sz, i) => (i === state.roundWinner ? sz - 1 : sz))
    void dealRound(sizes, true)
  }

  const myTurn = state.phase === 'turn' && state.turn === YOU
  const discardTop = state.discard[state.discard.length - 1]
  const over = state.phase === 'gameover'
  const opponents = state.slots.map((_, i) => i).filter((i) => i !== YOU)

  if (!started) {
    return (
      <Layout title="Trash">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-4 text-center">
          <p className="text-card/80">Playing solo? Pick how many AI opponents to face.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: MAX_SEATS - MIN_SEATS + 1 }, (_, i) => MIN_SEATS + i).map((n) => (
              <Button
                key={n}
                variant={n === seatCount ? 'gold' : 'ghost'}
                onClick={() => setSeatCount(n)}
              >
                {n - 1} AI{n - 1 === 1 ? '' : 's'}
              </Button>
            ))}
          </div>
          <Button size="lg" variant="gold" onClick={() => setStarted(true)}>
            Deal
          </Button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout
      title="Trash"
      action={
        <Button
          variant="gold"
          onClick={() => void dealRound(Array(seatCount).fill(ROW_SIZE), false)}
          disabled={dealing}
        >
          New game
        </Button>
      }
    >
      {deck.error && (
        <div className="mb-4">
          <ErrorNotice
            message={deck.error}
            onRetry={() => void dealRound(Array(seatCount).fill(ROW_SIZE), false)}
          />
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
            Round {state.round} · turns {state.turnsTaken}
          </p>

          <div className="flex flex-col items-center gap-4">
            {opponents.map((seat) => (
              <Row
                key={seat}
                slots={state.slots[seat]}
                label={`${opponents.length > 1 ? `Seat ${seat + 1}` : 'Dealer'} — lays ${state.sizes[seat]}`}
              />
            ))}
          </div>

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
            slots={state.slots[YOU]}
            label={`You — lay ${state.sizes[YOU]}`}
            onPick={
              state.phase === 'wildChoice' && state.turn === YOU
                ? (i) => {
                    feedback('flip')
                    dispatch({ type: 'PLACE_WILD', slot: i })
                  }
                : undefined
            }
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
              <Button
                size="lg"
                variant="accent"
                onClick={() => {
                  feedback('flip')
                  dispatch({ type: 'DRAW' })
                }}
              >
                Draw
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => {
                  feedback('flip')
                  dispatch({ type: 'TAKE_DISCARD' })
                }}
                disabled={!discardTop}
              >
                Take discard
              </Button>
            </div>
          )}

          {over && (
            <div className="flex flex-col items-center gap-3">
              <p className="font-display text-xl text-gold">
                {state.matchWinner === YOU
                  ? 'You win the match!'
                  : opponents.length > 1
                    ? `Seat ${state.matchWinner! + 1} wins the match.`
                    : 'The dealer wins the match.'}
              </p>
              {state.matchWinner === YOU && (
                <ScoreSubmit game="trash" score={state.turnsTaken} />
              )}
              <Button
                size="lg"
                variant="gold"
                onClick={() => void dealRound(Array(seatCount).fill(ROW_SIZE), false)}
              >
                Play again
              </Button>
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}
