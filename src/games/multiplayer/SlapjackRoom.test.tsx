// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SlapjackRoom } from './SlapjackRoom'
import { initSlapjack, slapjackReducer } from '../slapjack/slapjackReducer'
import { card } from '../../test/helpers'
import type { RoomView } from '../../lib/multiplayer'

const state = slapjackReducer(initSlapjack(), {
  type: 'START',
  playerPile: [card('2'), card('3')],
  aiPile: [card('4'), card('5')],
})

const view = (over: Partial<RoomView> = {}): RoomView => ({
  code: 'ABCDEF',
  game: 'slapjack',
  phase: 'playing',
  seats: ['Me', 'Them'],
  version: 1,
  state,
  youSeat: 0,
  youHost: true,
  ...over,
})

describe('<SlapjackRoom>', () => {
  it('sends FLIP when it is my turn to flip', async () => {
    const send = vi.fn()
    render(<SlapjackRoom view={view()} send={send} onRematch={vi.fn()} sending={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Flip' }))
    expect(send).toHaveBeenCalledWith({ type: 'FLIP' })
  })

  it('Slap is always clickable regardless of turn — real slapjack has no turn on a slap', () => {
    render(<SlapjackRoom view={view()} send={vi.fn()} onRematch={vi.fn()} sending={false} />)
    expect(screen.getByRole('button', { name: 'Slap!' })).toBeEnabled()
  })

  it('disables both action buttons while a request is in flight', () => {
    render(<SlapjackRoom view={view()} send={vi.fn()} onRematch={vi.fn()} sending />)
    expect(screen.getByRole('button', { name: 'Flip' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Slap!' })).toBeDisabled()
  })

  it('a spectator cannot slap', () => {
    render(<SlapjackRoom view={view({ youSeat: null })} send={vi.fn()} onRematch={vi.fn()} sending={false} />)
    expect(screen.getByRole('button', { name: 'Slap!' })).toBeDisabled()
  })
})
