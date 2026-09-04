// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Grid } from './Grid'
import type { Tile } from '../memoryLogic'

const tiles: Tile[] = [
  { id: 0, code: 'AS', image: 'https://deckofcardsapi.com/static/img/AS.png' },
  { id: 1, code: 'AS', image: 'https://deckofcardsapi.com/static/img/AS.png' },
  { id: 2, code: 'KH', image: 'https://deckofcardsapi.com/static/img/KH.png' },
  { id: 3, code: 'KH', image: 'https://deckofcardsapi.com/static/img/KH.png' },
]

describe('<Grid>', () => {
  it('flips a face-down, unlocked tile on click', async () => {
    const onFlip = vi.fn()
    render(
      <Grid tiles={tiles} gridSize={4} flipped={[]} matched={[]} justMatched={[]} lock={false} onFlip={onFlip} />,
    )
    const faceDown = screen.getAllByRole('button', { name: 'Face-down card' })
    expect(faceDown).toHaveLength(4)
    await userEvent.click(faceDown[0])
    expect(onFlip).toHaveBeenCalledWith(0)
  })

  it('ignores a click on a tile that is already face up', async () => {
    const onFlip = vi.fn()
    render(
      <Grid tiles={tiles} gridSize={4} flipped={[0]} matched={[]} justMatched={[]} lock={false} onFlip={onFlip} />,
    )
    // Tile 0 is up, so its accessible name switches to its card code.
    expect(screen.getByRole('button', { name: 'Card AS' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Card AS' }))
    expect(onFlip).not.toHaveBeenCalled()
  })

  it('the match-lock: every tile is unclickable while a mismatch is being shown', async () => {
    const onFlip = vi.fn()
    // Two mismatched tiles are flipped and the reducer has set lock: true —
    // a third card must not be flippable until the beat resolves.
    render(
      <Grid tiles={tiles} gridSize={4} flipped={[0, 2]} matched={[]} justMatched={[]} lock onFlip={onFlip} />,
    )
    const stillFaceDown = screen.getAllByRole('button', { name: 'Face-down card' })[0]
    expect(stillFaceDown).toBeDisabled()
    await userEvent.click(stillFaceDown)
    expect(onFlip).not.toHaveBeenCalled()
  })

  it('a matched pair stays disabled and pulses', () => {
    render(
      <Grid tiles={tiles} gridSize={4} flipped={[]} matched={[0, 1]} justMatched={[0, 1]} lock={false} onFlip={vi.fn()} />,
    )
    const matchedCard = screen.getAllByRole('button', { name: 'Card AS' })[0]
    expect(matchedCard).toBeDisabled()
  })
})
