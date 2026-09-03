import { Navigate, Route, Routes } from 'react-router-dom'
import { Hub } from './games/hub/Hub'
import { Blackjack } from './games/blackjack/Blackjack'
import { Memory } from './games/memory/Memory'
import { War } from './games/war/War'
import { HighLow } from './games/highlow/HighLow'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Hub />} />
      <Route path="/blackjack" element={<Blackjack />} />
      <Route path="/memory" element={<Memory />} />
      <Route path="/war" element={<War />} />
      <Route path="/high-low" element={<HighLow />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
