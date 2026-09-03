import { useState } from 'react'
import { Layout } from '../../components/Layout'
import { useLeaderboard } from '../../hooks/useLeaderboard'
import { formatScore, GAME_KEYS, GAMES, type GameKey } from '../../lib/leaderboard'
import { timeAgo } from '../../lib/timeAgo'

function Board({ game }: { game: GameKey }) {
  const { entries, loading, error } = useLeaderboard(game, 10)
  const meta = GAMES[game]

  return (
    <div className="rounded-2xl border border-gold/30 bg-felt p-4 shadow-xl shadow-black/30 sm:p-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold text-card">{meta.title}</h2>
        <span className="text-xs uppercase tracking-widest text-gold/80">
          {meta.metricLabel} · {meta.higherIsBetter ? 'high' : 'low'} wins
        </span>
      </div>
      <p className="mb-3 text-xs text-card/60">{meta.metricHint}</p>

      {loading ? (
        <p className="py-6 text-center text-sm text-card/60">Loading…</p>
      ) : error ? (
        <p className="py-6 text-center text-sm text-casino">{error}</p>
      ) : entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-card/60">
          No scores yet — be the first.
        </p>
      ) : (
        <ol className="flex flex-col">
          {entries.map((e, i) => (
            <li
              key={`${e.name}-${e.createdAt}-${i}`}
              className="flex items-center gap-3 border-b border-gold/10 py-2 last:border-0"
            >
              <span
                className={`w-6 text-right font-bold tabular-nums ${
                  i === 0 ? 'text-gold' : 'text-card/60'
                }`}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-card">{e.name}</span>
              <span className="tabular-nums font-semibold text-card">
                {formatScore(game, e.score)}
              </span>
              <span className="hidden w-24 text-right text-xs text-card/50 sm:block">
                {timeAgo(e.createdAt)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function Leaderboard() {
  const [game, setGame] = useState<GameKey>(GAME_KEYS[0])

  return (
    <Layout title="Leaderboard">
      <div className="mb-4 flex flex-wrap gap-2">
        {GAME_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setGame(key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              game === key ? 'bg-gold text-ink' : 'border border-gold/40 text-card/80 hover:text-card'
            }`}
          >
            {GAMES[key].title}
          </button>
        ))}
      </div>

      <Board game={game} />

      <p className="mt-4 text-center text-xs text-card/50">
        Scores are shared across everyone who plays. Finish a game to add yours.
      </p>
    </Layout>
  )
}
