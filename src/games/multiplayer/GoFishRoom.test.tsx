// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GoFishRoom } from './GoFishRoom'
import { goFishReducer, initGoFish } from '../gofish/goFishReducer'
import { hand } from '../../test/helpers'
import type { RoomView } from '../../lib/multiplayer'

const view = (state: unknown, over: Partial<RoomView> = {}): RoomView => ({
  code: 'ABCDEF',
  game: 'go-fish',
  phase: 'playing',
  seats: ['Me', 'Them'],
  version: 1,
  state,
  youSeat: 0,
  youHost: true,
  ...over,
})

describe('<GoFishRoom>', () => {
  it('2-seat room: asking sends the ask directly with the only possible target', async () => {
    const dealt = goFishReducer(initGoFish(2), {
      type: 'START',
      hands: [hand('5', '9'), hand('3')],
      stock: hand('KING'),
    })
    const send = vi.fn()
    render(<GoFishRoom view={view(dealt)} send={send} onRematch={vi.fn()} sending={false} />)
    await userEvent.click(screen.getByRole('button', { name: '5' }))
    expect(send).toHaveBeenCalledWith({ type: 'ASK', rank: '5', target: 1, seat: 0 })
  })

  it('3-seat room: asking a rank shows a target picker before sending', async () => {
    const dealt = goFishReducer(initGoFish(3), {
      type: 'START',
      hands: [hand('5', '9'), hand('3'), hand('7')],
      stock: hand('KING'),
    })
    const send = vi.fn()
    render(
      <GoFishRoom
        view={view(dealt, { seats: ['Me', 'A', 'B'] })}
        send={send}
        onRematch={vi.fn()}
        sending={false}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: '5' }))
    expect(send).not.toHaveBeenCalled()
    expect(screen.getByText('Who do you want to ask?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Seat 3' }))
    expect(send).toHaveBeenCalledWith({ type: 'ASK', rank: '5', target: 2, seat: 0 })
  })

  it('sends DRAW tagged with my seat when it is my turn to fish', async () => {
    let dealt = goFishReducer(initGoFish(2), {
      type: 'START',
      hands: [hand('5'), hand('3')],
      stock: hand('KING'),
    })
    dealt = goFishReducer(dealt, { type: 'ASK', rank: '5', target: 1, seat: 0 }) // miss -> my draw
    const send = vi.fn()
    render(<GoFishRoom view={view(dealt)} send={send} onRematch={vi.fn()} sending={false} />)
    await userEvent.click(screen.getByRole('button', { name: '🎣 Go fish' }))
    expect(send).toHaveBeenCalledWith({ type: 'DRAW', seat: 0 })
  })

  it('a spectator sees no ask or draw controls', () => {
    const dealt = goFishReducer(initGoFish(2), {
      type: 'START',
      hands: [hand('5'), hand('3')],
      stock: hand('KING'),
    })
    render(
      <GoFishRoom view={view(dealt, { youSeat: null })} send={vi.fn()} onRematch={vi.fn()} sending={false} />,
    )
    expect(screen.queryByRole('button', { name: '5' })).not.toBeInTheDocument()
  })
})
