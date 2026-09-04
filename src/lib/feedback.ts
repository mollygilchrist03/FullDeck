import { playSound, type SoundName } from './sound'
import { vibrate, type HapticName } from './haptics'

/** Fires a moment's sound and (where one exists) its matching haptic pattern.
 * The one call site every game reaches for — see sound.ts / haptics.ts for
 * the individual effects if only one is wanted. */
export function feedback(name: SoundName): void {
  playSound(name)
  if (name !== 'deal') vibrate(name as HapticName)
}
