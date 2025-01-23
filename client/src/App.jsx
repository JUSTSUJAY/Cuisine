import { BrowserRouter, Routes, Route } from 'react-router-dom';
import GameConfig from './GameConfig';
import HostPanel from './HostPanel';
import PlayerLobby from './PlayerLobby';
import GamePlay from './GamePlay';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GameConfig />} />
        <Route path="/host/:gameId" element={<HostPanel />} />
        <Route path="/play/:gameId" element={<PlayerLobby />} />
        <Route path="/game/:gameId" element={<GamePlay />} />
      </Routes>
    </BrowserRouter>
  );
}