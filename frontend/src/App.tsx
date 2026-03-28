import { Routes, Route } from 'react-router';
import LobbyView from './views/LobbyView';
import GameView from './views/GameView';
import VerdictView from './views/VerdictView';

export default function App() {
  return (
    <div className="min-h-screen bg-court-bg">
      <Routes>
        <Route path="/" element={<LobbyView />} />
        <Route path="/lobby" element={<LobbyView />} />
        <Route path="/game" element={<GameView />} />
        <Route path="/verdict" element={<VerdictView />} />
      </Routes>
    </div>
  );
}
