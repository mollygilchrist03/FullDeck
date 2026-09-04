import { useSyncExternalStore } from 'react'
import { isMuted, subscribeMuted } from '../lib/soundSettings'

/** Reactive read of the shared sound/haptics mute preference. */
export function useMuted(): boolean {
  return useSyncExternalStore(subscribeMuted, isMuted, () => false)
}
