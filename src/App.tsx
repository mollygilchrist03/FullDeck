import { Navigate, Route, Routes } from 'react-router-dom'
import { Hub } from './games/hub/Hub'
import { Blackjack } from './games/blackjack/Blackjack'
import { Memory } from './games/memory/Memory'
import { War } from './games/war/War'
import { HighLow } from './games/highlow/HighLow'
import { VideoPoker } from './games/videopoker/VideoPoker'
import { CrazyEights } from './games/crazyeights/CrazyEights'
import { Slapjack } from './games/slapjack/Slapjack'
import { GoFish } from './games/gofish/GoFish'
import { Trash } from './games/trash/Trash'
import { Leaderboard } from './games/leaderboard/Leaderboard'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Hub />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/blackjack" element={<Blackjack />} />
      <Route path="/memory" element={<Memory />} />
      <Route path="/war" element={<War />} />
      <Route path="/high-low" element={<HighLow />} />
      <Route path="/video-poker" element={<VideoPoker />} />
      <Route path="/crazy-eights" element={<CrazyEights />} />
      <Route path="/slapjack" element={<Slapjack />} />
      <Route path="/go-fish" element={<GoFish />} />
      <Route path="/trash" element={<Trash />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
