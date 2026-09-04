import { useCallback, useEffect, useRef, useState } from 'react'
import type { MpGameKey, RoomView } from '../lib/multiplayer'

const seatKey = (code: string) => `fulldeck:room:${code}`

export function loadSeatId(code: string): string | null {
  try {
    return sessionStorage.getItem(seatKey(code))
  } catch {
    return null
  }
}
function saveSeatId(code: string, seatId: string): void {
  try {
    sessionStorage.setItem(seatKey(code), seatId)
  } catch {
    /* private mode */
  }
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  let data: Record<string, unknown> = {}
  try {
    data = (await res.json()) as Record<string, unknown>
  } catch {
    throw new Error('Multiplayer API is unavailable here — try the deployed site.')
  }
  if (!res.ok) throw new Error((data.error as string) ?? 'Request failed.')
  return data
}

/** Create a room. Returns the join code; the seat id is stashed for reconnects. */
export async function createRoom(game: MpGameKey, name: string): Promise<string> {
  const data = await postJson('/api/rooms', { game, name })
  saveSeatId(data.code as string, data.seatId as string)
  return data.code as string
}

/** Take the open seat in an existing room. */
export async function joinRoom(code: string, name: string): Promise<void> {
  const data = await postJson(`/api/rooms/${code}`, { op: 'join', name })
  saveSeatId(code, data.seatId as string)
}

interface UseRoom {
  room: RoomView | null
  error: string | null
  /** True while one of our own actions is in flight — disable buttons on this. */
  sending: boolean
  send: (action: unknown) => Promise<void>
  start: () => Promise<void>
  rematch: () => Promise<void>
}

/** Connect to a room and keep its state live via long-polling. */
export function useRoom(code: string): UseRoom {
  const [room, setRoom] = useState<RoomView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const versionRef = useRef(-1)
  const seatIdRef = useRef<string | null>(null)

  useEffect(() => {
    seatIdRef.current = loadSeatId(code)
    let alive = true
    versionRef.current = -1

    const poll = async () => {
      while (alive) {
        try {
          // Re-read each loop so a join elsewhere in this tab is picked up.
          seatIdRef.current = loadSeatId(code)
          const seat = seatIdRef.current
          const params = new URLSearchParams()
          if (seat) params.set('seatId', seat)
          if (versionRef.current >= 0) {
            params.set('since', String(versionRef.current))
            params.set('wait', '1')
          }
          const res = await fetch(`/api/rooms/${code}?${params}`)
          if (!alive) return
          if (res.status === 404) {
            setError('That room no longer exists.')
            return
          }
          if (!res.ok) throw new Error('lost connection')
          const view = (await res.json()) as RoomView
          if (!alive) return
          versionRef.current = view.version
          setRoom(view)
          setError(null)
        } catch {
          if (!alive) return
          setError('Reconnecting…')
          await new Promise((r) => setTimeout(r, 1500))
        }
      }
    }
    void poll()
    return () => {
      alive = false
    }
  }, [code])

  const op = useCallback(
    async (payload: Record<string, unknown>) => {
      setSending(true)
      try {
        const data = await postJson(`/api/rooms/${code}`, {
          ...payload,
          seatId: seatIdRef.current,
        })
        // action/start return a fresh view; a 409 resync carries `room`.
        const next = (data.room ?? data) as RoomView
        if (next && typeof next.version === 'number') {
          versionRef.current = next.version
          setRoom(next)
        }
      } finally {
        setSending(false)
      }
    },
    [code],
  )

  return {
    room,
    error,
    sending,
    send: (action) => op({ op: 'action', action }),
    start: () => op({ op: 'start' }),
    rematch: () => op({ op: 'rematch' }),
  }
}
