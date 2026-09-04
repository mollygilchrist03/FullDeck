/**
 * Every effect is synthesised on the fly with the Web Audio API — no audio
 * files to source, license, or ship. A handful of oscillator/noise voices
 * with a short gain envelope is enough for felt-table-sized sound cues.
 */
import { isMuted } from './soundSettings'

export type SoundName = 'deal' | 'flip' | 'slap' | 'win' | 'lose'

let sharedCtx: AudioContext | null = null

/** Lazily creates the single shared AudioContext. Browsers block audio
 * before a user gesture, so this only actually starts producing sound once
 * a click has happened somewhere — exactly when these effects fire anyway. */
function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!sharedCtx) sharedCtx = new Ctor()
  return sharedCtx
}

/** A short tone with a quick attack and exponential decay — a "blip". */
function tone(ctx: AudioContext, when: number, freq: number, duration: number, peak: number, type: OscillatorType = 'sine') {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, when)
  gain.gain.setValueAtTime(0, when)
  gain.gain.linearRampToValueAtTime(peak, when + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(when)
  osc.stop(when + duration + 0.02)
}

/** A short burst of filtered noise — a card-on-felt "tick" or a slap's snap. */
function noiseBurst(ctx: AudioContext, when: number, duration: number, peak: number, filterFreq: number) {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * duration))
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1

  const src = ctx.createBufferSource()
  src.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = filterFreq
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(peak, when)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)

  src.connect(filter).connect(gain).connect(ctx.destination)
  src.start(when)
}

const EFFECTS: Record<SoundName, (ctx: AudioContext) => void> = {
  deal: (ctx) => noiseBurst(ctx, ctx.currentTime, 0.09, 0.18, 2200),
  flip: (ctx) => tone(ctx, ctx.currentTime, 620, 0.07, 0.12, 'triangle'),
  slap: (ctx) => {
    noiseBurst(ctx, ctx.currentTime, 0.07, 0.35, 900)
    tone(ctx, ctx.currentTime, 140, 0.08, 0.15, 'square')
  },
  win: (ctx) => {
    const now = ctx.currentTime
    ;[523.25, 659.25, 783.99].forEach((freq, i) => tone(ctx, now + i * 0.09, freq, 0.22, 0.14))
  },
  lose: (ctx) => {
    const now = ctx.currentTime
    ;[311.13, 233.08].forEach((freq, i) => tone(ctx, now + i * 0.11, freq, 0.24, 0.12, 'sawtooth'))
  },
}

/** Play a named effect. Silently does nothing if muted, unsupported, or the
 * browser hasn't unlocked audio yet — sound is flavour, never load-bearing. */
export function playSound(name: SoundName): void {
  if (isMuted()) return
  const ctx = getContext()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') void ctx.resume()
    EFFECTS[name](ctx)
  } catch {
    /* best-effort */
  }
}
