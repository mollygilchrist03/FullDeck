/**
 * A single "effects on/off" preference shared by sound and haptics, persisted
 * per-browser. Plain module state (not React state) so non-component code —
 * `sound.ts`, `haptics.ts` — can read it without a hook; `useMuted` below
 * exposes it reactively to the mute toggle button via `useSyncExternalStore`.
 */

const STORAGE_KEY = 'fulldeck:muted'

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

let muted = typeof window === 'undefined' ? false : readStored()
const listeners = new Set<() => void>()

export function isMuted(): boolean {
  return muted
}

export function setMuted(next: boolean): void {
  if (next === muted) return
  muted = next
  try {
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
  } catch {
    /* private mode / storage disabled — the preference just won't persist */
  }
  listeners.forEach((fn) => fn())
}

export function toggleMuted(): void {
  setMuted(!muted)
}

/** For useSyncExternalStore. */
export function subscribeMuted(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}
