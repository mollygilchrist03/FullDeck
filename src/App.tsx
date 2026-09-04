import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Hub } from './games/hub/Hub'
import { Loading } from './components/Loading'

// Route-level code splitting: the hub (the very first thing anyone sees) loads
// eagerly, every game and the multiplayer/leaderboard screens load on demand
// so a visitor never downloads code for games they haven't opened.
const Blackjack = lazy(() => import('./games/blackjack/Blackjack').then((m) => ({ default: m.Blackjack })))
const Memory = lazy(() => import('./games/memory/Memory').then((m) => ({ default: m.Memory })))
const War = lazy(() => import('./games/war/War').then((m) => ({ default: m.War })))
const HighLow = lazy(() => import('./games/highlow/HighLow').then((m) => ({ default: m.HighLow })))
const VideoPoker = lazy(() =>
  import('./games/videopoker/VideoPoker').then((m) => ({ default: m.VideoPoker })),
)
const CrazyEights = lazy(() =>
  import('./games/crazyeights/CrazyEights').then((m) => ({ default: m.CrazyEights })),
)
const Slapjack = lazy(() => import('./games/slapjack/Slapjack').then((m) => ({ default: m.Slapjack })))
const GoFish = lazy(() => import('./games/gofish/GoFish').then((m) => ({ default: m.GoFish })))
const Trash = lazy(() => import('./games/trash/Trash').then((m) => ({ default: m.Trash })))
const OldMaid = lazy(() => import('./games/oldmaid/OldMaid').then((m) => ({ default: m.OldMaid })))
const Leaderboard = lazy(() =>
  import('./games/leaderboard/Leaderboard').then((m) => ({ default: m.Leaderboard })),
)
const Multiplayer = lazy(() =>
  import('./games/multiplayer/Multiplayer').then((m) => ({ default: m.Multiplayer })),
)
const Room = lazy(() => import('./games/multiplayer/Room').then((m) => ({ default: m.Room })))

export function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Hub />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/multiplayer" element={<Multiplayer />} />
        <Route path="/room/:code" element={<Room />} />
        <Route path="/blackjack" element={<Blackjack />} />
        <Route path="/memory" element={<Memory />} />
        <Route path="/war" element={<War />} />
        <Route path="/high-low" element={<HighLow />} />
        <Route path="/video-poker" element={<VideoPoker />} />
        <Route path="/crazy-eights" element={<CrazyEights />} />
        <Route path="/slapjack" element={<Slapjack />} />
        <Route path="/go-fish" element={<GoFish />} />
        <Route path="/trash" element={<Trash />} />
        <Route path="/old-maid" element={<OldMaid />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
