// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WarBoard } from './WarBoard'
import { initWar, warReducer, type WarState } from './warReducer'
import { card } from '../../test/helpers'
import type { Card } from '../../types/card'

const deck = (ranks: Parameters<typeof card>[0][]): Card[] => ranks.map((r) => card(r))
const readyState = (): WarState =>
  warReducer(initWar(), {
    type: 'START',
    playerPile: deck(['KING', '2']),
    dealerPile: deck(['3', '4']),
  })

describe('<WarBoard>', () => {
  it('calls onFlip when Battle is clicked', async () => {
    const onFlip = vi.fn()
    render(<WarBoard state={readyState()} mySeat={0} onFlip={onFlip} />)
    await userEvent.click(screen.getByRole('button', { name: 'Battle' }))
    expect(onFlip).toHaveBeenCalledTimes(1)
  })

  it('disables Battle when flipDisabled is set (e.g. a request is in flight)', () => {
    render(<WarBoard state={readyState()} mySeat={0} onFlip={vi.fn()} flipDisabled />)
    expect(screen.getByRole('button', { name: 'Battle' })).toBeDisabled()
  })

  it('hides the button and shows a waiting message once I have readied up', () => {
    render(
      <WarBoard
        state={readyState()}
        mySeat={0}
        onFlip={vi.fn()}
        ready={{ mine: true, theirs: false }}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Battle' })).not.toBeInTheDocument()
    expect(screen.getByText('Waiting for your opponent to battle…')).toBeInTheDocument()
  })

  it('hints when the opponent is ready but I have not battled yet', () => {
    render(
      <WarBoard
        state={readyState()}
        mySeat={0}
        onFlip={vi.fn()}
        ready={{ mine: false, theirs: true }}
      />,
    )
    expect(screen.getByRole('button', { name: 'Battle' })).toBeEnabled()
    expect(screen.getByText("Your opponent is ready — it's on you.")).toBeInTheDocument()
  })

  it('a spectator sees the waiting note instead of any button', () => {
    render(
      <WarBoard state={readyState()} mySeat={0} onFlip={vi.fn()} flipDisabled waitingNote="Spectating." />,
    )
    expect(screen.queryByRole('button', { name: 'Battle' })).not.toBeInTheDocument()
    expect(screen.getByText('Spectating.')).toBeInTheDocument()
  })

  it('labels the button "Go to war" during a war round', () => {
    const s = warReducer(readyState(), { type: 'FLIP' }) // set up a tie -> war is likelier with crafted piles
    const warState: WarState = { ...s, phase: 'war' }
    render(<WarBoard state={warState} mySeat={0} onFlip={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Go to war' })).toBeInTheDocument()
  })
})
