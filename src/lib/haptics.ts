import { isMuted } from './soundSettings'

export type HapticName = 'flip' | 'slap' | 'win' | 'lose'

// Short, deliberately understated patterns (ms) — a felt table should buzz,
// not rattle. Vibration API support is Android-Chrome-family only (no iOS
// Safari, no desktop), so this is a bonus for the devices that have it.
const PATTERNS: Record<HapticName, number | number[]> = {
  flip: 8,
  slap: [0, 25, 20, 25],
  win: [0, 20, 40, 20, 40, 30],
  lose: 60,
}

/** Fire a short vibration pattern. No-ops when muted or unsupported. */
export function vibrate(name: HapticName): void {
  if (isMuted()) return
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(PATTERNS[name])
  } catch {
    /* best-effort */
  }
}
