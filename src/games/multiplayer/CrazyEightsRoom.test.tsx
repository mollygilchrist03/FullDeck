// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CrazyEightsRoom } from './CrazyEightsRoom'
import { crazyEightsReducer, initCrazyEights } from '../crazyeights/crazyEightsReducer'
import { card } from '../../test/helpers'
import type { RoomView } from '../../lib/multiplayer'

const view = (state: unknown, over: Partial<RoomView> = {}): RoomView => ({
  code: 'ABCDEF',
  game: 'crazy-eights',
  phase: 'playing',
  seats: ['Me', 'Them'],
  version: 1,
  state,
  youSeat: 0,
  youHost: true,
  ...over,
})

// My turn: a 5 that matches the top card's rank is playable, a 9 is not.
const playable = crazyEightsReducer(initCrazyEights(), {
  type: 'START',
  stock: [card('2', 'CLUBS')],
  discard: [card('5', 'HEARTS')],
  playerHand: [card('5', 'SPADES'), card('9', 'CLUBS')],
  aiHand: [card('3', 'DIAMONDS')],
  activeSuit: 'HEARTS',
})

// My turn, nothing playable, stock non-empty: must draw.
const mustDraw = crazyEightsReducer(initCrazyEights(), {
  type: 'START',
  stock: [card('2', 'CLUBS')],
  discard: [card('5', 'HEARTS')],
  playerHand: [card('9', 'CLUBS')],
  aiHand: [card('3', 'DIAMONDS')],
  activeSuit: 'HEARTS',
})

// I've just played an eight and need to name the next suit.
const dealt8 = crazyEightsReducer(initCrazyEights(), {
  type: 'START',
  stock: [card('2', 'CLUBS')],
  discard: [card('5', 'HEARTS')],
  // A second card so playing the eight doesn't empty the hand and end the game.
  playerHand: [card('8', 'SPADES'), card('4', 'CLUBS')],
  aiHand: [card('3', 'DIAMONDS')],
  activeSuit: 'HEARTS',
})
const awaitSuit = crazyEightsReducer(dealt8, { type: 'PLAY', index: 0, side: 'player' })

describe('<CrazyEightsRoom>', () => {
  it('plays a legal card, tagged with my side', async () => {
    const send = vi.fn()
    render(<CrazyEightsRoom view={view(playable)} send={send} onRematch={vi.fn()} sending={false} />)
    await userEvent.click(screen.getByRole('button', { name: '5 of spades' }))
    expect(send).toHaveBeenCalledWith({ type: 'PLAY', index: 0, side: 'player' })
  })

  it('an unplayable card renders inert, with no click handler at all', () => {
    render(<CrazyEightsRoom view={view(playable)} send={vi.fn()} onRematch={vi.fn()} sending={false} />)
    // Card only renders as a <button> when it has an onClick; an illegal card
    // gets none, so it shows up as plain (non-interactive) content, not a
    // disabled button.
    expect(screen.queryByRole('button', { name: '9 of clubs' })).not.toBeInTheDocument()
    expect(screen.getByAltText('9 of clubs')).toBeInTheDocument()
  })

  it('Draw is enabled and Pass is not when I have no legal card', () => {
    render(<CrazyEightsRoom view={view(mustDraw)} send={vi.fn()} onRematch={vi.fn()} sending={false} />)
    expect(screen.getByRole('button', { name: 'Draw' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Pass' })).toBeDisabled()
  })

  it('disables a legal card while a request is in flight', () => {
    render(<CrazyEightsRoom view={view(playable)} send={vi.fn()} onRematch={vi.fn()} sending />)
    expect(screen.getByRole('button', { name: '5 of spades' })).toBeDisabled()
  })

  it('disables Draw while a request is in flight', () => {
    render(<CrazyEightsRoom view={view(mustDraw)} send={vi.fn()} onRematch={vi.fn()} sending />)
    expect(screen.getByRole('button', { name: 'Draw' })).toBeDisabled()
  })

  it('choosing a suit sends CHOOSE_SUIT tagged with my side', async () => {
    const send = vi.fn()
    render(<CrazyEightsRoom view={view(awaitSuit)} send={send} onRematch={vi.fn()} sending={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'SPADES' }))
    expect(send).toHaveBeenCalledWith({ type: 'CHOOSE_SUIT', suit: 'SPADES', side: 'player' })
  })
})
