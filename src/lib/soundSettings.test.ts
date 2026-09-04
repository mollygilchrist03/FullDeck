import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isMuted, setMuted, subscribeMuted, toggleMuted } from './soundSettings'

describe('soundSettings', () => {
  beforeEach(() => {
    setMuted(false)
  })

  it('defaults to unmuted', () => {
    expect(isMuted()).toBe(false)
  })

  it('setMuted updates the value', () => {
    setMuted(true)
    expect(isMuted()).toBe(true)
    setMuted(false)
    expect(isMuted()).toBe(false)
  })

  it('toggleMuted flips the current value', () => {
    expect(isMuted()).toBe(false)
    toggleMuted()
    expect(isMuted()).toBe(true)
    toggleMuted()
    expect(isMuted()).toBe(false)
  })

  it('notifies subscribers only on an actual change', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeMuted(listener)

    setMuted(false) // already false — no change, no notification
    expect(listener).not.toHaveBeenCalled()

    setMuted(true)
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    setMuted(false)
    expect(listener).toHaveBeenCalledTimes(1) // unsubscribed — no further calls
  })
})
