import { Navigate, Route, Routes } from 'react-router-dom'
import { Hub } from './games/hub/Hub'
import { Blackjack } from './games/blackjack/Blackjack'
import { Memory } from './games/memory/Memory'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Hub />} />
      <Route path="/blackjack" element={<Blackjack />} />
      <Route path="/memory" element={<Memory />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
