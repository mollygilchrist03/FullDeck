// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HoldemRoom } from './HoldemRoom'
import { holdemReducer, maxBetTo, type HoldemState } from '../holdem/holdemReducer'
import { card } from '../../test/helpers'
import type { RoomView } from '../../lib/multiplayer'

const view = (state: unknown, over: Partial<RoomView> = {}): RoomView => ({
  code: 'ABCDEF',
  game: 'holdem',
  phase: 'playing',
  seats: ['Me', 'Them'],
  version: 1,
  state,
  youSeat: 0,
  youHost: true,
  ...over,
})

// Heads-up deal: seat 0 is the button/small blind and acts first preflop.
const dealt: HoldemState = holdemReducer(undefined as unknown as HoldemState, {
  type: 'START',
  seatCount: 2,
  holes: [
    [card('ACE', 'SPADES'), card('KING', 'SPADES')],
    [card('2', 'HEARTS'), card('7', 'CLUBS')],
  ],
  board: [card('QUEEN', 'SPADES'), card('JACK', 'SPADES'), card('4', 'SPADES'), card('9', 'CLUBS'), card('3', 'HEARTS')],
})

describe('<HoldemRoom>', () => {
  it('calls, tagged with my seat', async () => {
    const send = vi.fn()
    render(<HoldemRoom view={view(dealt)} send={send} onRematch={vi.fn()} sending={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Call $5' }))
    expect(send).toHaveBeenCalledWith({ type: 'CALL', seat: 0 })
  })

  it('folds, tagged with my seat', async () => {
    const send = vi.fn()
    render(<HoldemRoom view={view(dealt)} send={send} onRematch={vi.fn()} sending={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Fold' }))
    expect(send).toHaveBeenCalledWith({ type: 'FOLD', seat: 0 })
  })

  it('shoves all-in for my seat’s full remaining stack', async () => {
    const send = vi.fn()
    render(<HoldemRoom view={view(dealt)} send={send} onRematch={vi.fn()} sending={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'All-in' }))
    expect(send).toHaveBeenCalledWith({ type: 'BET', seat: 0, to: maxBetTo(dealt, 0) })
  })

  it('shows no action buttons and a waiting note when it is not my turn', () => {
    render(<HoldemRoom view={view(dealt, { youSeat: 1 })} send={vi.fn()} onRematch={vi.fn()} sending={false} />)
    expect(screen.queryByRole('button', { name: 'Fold' })).not.toBeInTheDocument()
    expect(screen.getByText('Waiting on the table…')).toBeInTheDocument()
  })

  it('disables Fold and Call while a request is in flight', () => {
    render(<HoldemRoom view={view(dealt)} send={vi.fn()} onRematch={vi.fn()} sending />)
    expect(screen.getByRole('button', { name: 'Fold' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Call $5' })).toBeDisabled()
  })

  it('marks a busted seat as out and hides its action buttons even with the match still open', () => {
    const busted: HoldemState = {
      ...dealt,
      phase: 'handover',
      toAct: null,
      matchWinner: null,
      seats: dealt.seats.map((s, i) => (i === 0 ? { ...s, stack: 0, eliminated: true } : s)),
    }
    render(<HoldemRoom view={view(busted)} send={vi.fn()} onRematch={vi.fn()} sending={false} />)
    expect(screen.getByText(/You.*· out/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Fold' })).not.toBeInTheDocument()
  })
})
