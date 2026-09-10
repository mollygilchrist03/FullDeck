// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrashRoom } from './TrashRoom'
import { initTrash, trashReducer } from '../trash/trashReducer'
import { card, hand } from '../../test/helpers'
import type { RoomView } from '../../lib/multiplayer'

const view = (state: unknown, over: Partial<RoomView> = {}): RoomView => ({
  code: 'ABCDEF',
  game: 'trash',
  phase: 'playing',
  seats: ['Me', 'Them'],
  version: 1,
  state,
  youSeat: 0,
  youHost: true,
  ...over,
})

const deadLayout = (n: number) => hand(...Array.from({ length: n }, () => 'KING' as const))

describe('<TrashRoom>', () => {
  it('sends DRAW tagged with my seat on my turn', async () => {
    const dealt = trashReducer(initTrash(2), {
      type: 'START',
      stock: [card('ACE')],
      faceDown: [deadLayout(10), deadLayout(10)],
    })
    const send = vi.fn()
    render(<TrashRoom view={view(dealt)} send={send} onRematch={vi.fn()} sending={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Draw' }))
    expect(send).toHaveBeenCalledWith({ type: 'DRAW', seat: 0 })
  })

  it('sends PLACE_WILD tagged with my seat when a queen is drawn', async () => {
    let dealt = trashReducer(initTrash(2), {
      type: 'START',
      stock: [card('QUEEN')],
      faceDown: [deadLayout(10), deadLayout(10)],
    })
    dealt = trashReducer(dealt, { type: 'DRAW', seat: 0 })
    expect(dealt.phase).toBe('wildChoice')
    const send = vi.fn()
    render(<TrashRoom view={view(dealt)} send={send} onRematch={vi.fn()} sending={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Slot 1' }))
    expect(send).toHaveBeenCalledWith({ type: 'PLACE_WILD', slot: 0, seat: 0 })
  })

  it('shows no Draw/Take discard controls when it is not my turn', () => {
    const dealt = trashReducer(initTrash(2), {
      type: 'START',
      stock: [card('ACE')],
      faceDown: [deadLayout(10), deadLayout(10)],
    })
    render(
      <TrashRoom view={view(dealt, { youSeat: 1 })} send={vi.fn()} onRematch={vi.fn()} sending={false} />,
    )
    expect(screen.queryByRole('button', { name: 'Draw' })).not.toBeInTheDocument()
  })

  it('renders every other seat in a 4-player room', () => {
    const fourSeat = trashReducer(initTrash(4), {
      type: 'START',
      stock: [card('ACE')],
      faceDown: [deadLayout(10), deadLayout(10), deadLayout(10), deadLayout(10)],
    })
    render(
      <TrashRoom
        view={view(fourSeat, { seats: ['Me', 'A', 'B', 'C'] })}
        send={vi.fn()}
        onRematch={vi.fn()}
        sending={false}
      />,
    )
    expect(screen.getByText(/Seat 2/)).toBeInTheDocument()
    expect(screen.getByText(/Seat 3/)).toBeInTheDocument()
    expect(screen.getByText(/Seat 4/)).toBeInTheDocument()
  })
})
