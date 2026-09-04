import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { Button } from '../../components/Button'
import { Loading } from '../../components/Loading'
import { GAMES } from '../../lib/leaderboard'
import { normalizeCode } from '../../lib/multiplayer'
import { joinRoom, loadSeatId, useRoom } from '../../hooks/useRoom'
import { MpBoard } from './mpBoards'

function ShareLine({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/room/${code}`
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-card/70">Share this with your opponent:</p>
      <div className="flex items-center gap-2">
        <code className="rounded-lg border border-gold/40 bg-black/20 px-3 py-1.5 font-mono text-xl tracking-[0.3em] text-gold">
          {code}
        </code>
        <Button
          variant="ghost"
          onClick={() => {
            navigator.clipboard?.writeText(url).then(
              () => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              },
              () => {},
            )
          }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>
    </div>
  )
}

export function Room() {
  const code = normalizeCode(useParams().code ?? '')
  const { room, error, send, start, rematch } = useRoom(code)
  const [name, setName] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinErr, setJoinErr] = useState<string | null>(null)
  const seatedHere = loadSeatId(code) != null

  if (code.length !== 6) {
    return (
      <Layout title="Room">
        <p className="text-center text-casino">That room code doesn&apos;t look right.</p>
      </Layout>
    )
  }

  const title = room ? `${GAMES[room.game].title} · ${code}` : `Room ${code}`

  return (
    <Layout title={title}>
      {error && !room && <p className="mb-4 text-center text-casino">{error}</p>}

      {!room ? (
        <Loading label="Connecting to the room…" />
      ) : room.youSeat === null && !seatedHere ? (
        // Not seated yet — offer to take the open seat.
        <div className="mx-auto flex max-w-sm flex-col gap-3 text-center">
          {room.seats.every((s) => s !== null) ? (
            <p className="text-card/80">This room is full.</p>
          ) : (
            <>
              <p className="text-card/80">
                {room.seats.find((s) => s) ?? 'Someone'} invited you to play{' '}
                <strong>{GAMES[room.game].title}</strong>.
              </p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={16}
                placeholder="Your name"
                className="rounded-lg border border-gold/40 bg-felt px-3 py-2 text-center text-card placeholder:text-card/40 focus:border-gold focus:outline-none"
              />
              <Button
                variant="gold"
                disabled={joining || !name.trim()}
                onClick={async () => {
                  setJoining(true)
                  setJoinErr(null)
                  try {
                    await joinRoom(code, name.trim())
                  } catch (e) {
                    setJoinErr(e instanceof Error ? e.message : 'Could not join.')
                  } finally {
                    setJoining(false)
                  }
                }}
              >
                Join room
              </Button>
              {joinErr && <p className="text-sm text-casino">{joinErr}</p>}
            </>
          )}
        </div>
      ) : room.phase === 'lobby' ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-6">
          <div className="flex w-full justify-around text-center">
            {room.seats.map((s, i) => (
              <div key={i}>
                <p className="text-xs uppercase tracking-widest text-gold/80">Seat {i + 1}</p>
                <p className="text-lg font-bold text-card">{s ?? '— waiting —'}</p>
              </div>
            ))}
          </div>
          <ShareLine code={code} />
          {room.youHost ? (
            <Button
              size="lg"
              variant="gold"
              disabled={room.seats.some((s) => s === null)}
              onClick={() => void start()}
            >
              {room.seats.some((s) => s === null) ? 'Waiting for player 2…' : 'Start game'}
            </Button>
          ) : (
            <p className="text-sm text-card/70">Waiting for the host to start…</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5">
          <MpBoard view={room} send={(a) => void send(a)} onRematch={() => void rematch()} />
          {room.phase === 'done' && room.youHost && (
            <Button variant="gold" onClick={() => void rematch()}>
              Rematch
            </Button>
          )}
          {error && <p className="text-xs text-card/50">{error}</p>}
        </div>
      )}
    </Layout>
  )
}
