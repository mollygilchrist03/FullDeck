// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OldMaidRoom } from './OldMaidRoom'
import { initOldMaid, oldMaidReducer } from '../oldmaid/oldMaidReducer'
import { hand } from '../../test/helpers'
import type { RoomView } from '../../lib/multiplayer'

const view = (state: unknown, over: Partial<RoomView> = {}): RoomView => ({
  code: 'ABCDEF',
  game: 'old-maid',
  phase: 'playing',
  seats: ['Me', 'Them'],
  version: 1,
  state,
  youSeat: 0,
  youHost: true,
  ...over,
})

const dealt = oldMaidReducer(initOldMaid(2), {
  type: 'START',
  hands: [hand('KING'), hand('7', 'QUEEN')],
})

describe('<OldMaidRoom>', () => {
  it('draws a card from my neighbor on my turn', async () => {
    const send = vi.fn()
    render(<OldMaidRoom view={view(dealt)} send={send} onRematch={vi.fn()} sending={false} />)
    await userEvent.click(screen.getByRole('button', { name: "Take Seat 2's card 1" }))
    expect(send).toHaveBeenCalledWith({ type: 'DRAW', index: 0 })
  })

  it('disables drawing when it is not my turn', () => {
    const notMyTurn = { ...dealt, turn: 1 }
    render(<OldMaidRoom view={view(notMyTurn)} send={vi.fn()} onRematch={vi.fn()} sending={false} />)
    expect(screen.getByRole('button', { name: "Take Seat 2's card 1" })).toBeDisabled()
  })

  it('disables drawing while a request is in flight', () => {
    render(<OldMaidRoom view={view(dealt)} send={vi.fn()} onRematch={vi.fn()} sending />)
    expect(screen.getByRole('button', { name: "Take Seat 2's card 1" })).toBeDisabled()
  })

  it('renders every other seat in a 3-player room and only enables the live draw target', () => {
    const threeSeat = oldMaidReducer(initOldMaid(3), {
      type: 'START',
      hands: [hand('KING'), [], hand('9', 'QUEEN')],
    })
    render(
      <OldMaidRoom
        view={view(threeSeat, { seats: ['Me', 'A', 'B'] })}
        send={vi.fn()}
        onRematch={vi.fn()}
        sending={false}
      />,
    )
    // Seat 1 (index 1) is empty, so seat 0's draw target skips it and lands on seat 2.
    expect(screen.getByRole('button', { name: "Take Seat 3's card 1" })).toBeEnabled()
  })
})
