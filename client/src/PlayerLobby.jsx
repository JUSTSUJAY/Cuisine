import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

// Helper to generate a persistent ID.
const generatePlayerId = () => Math.random().toString(36).substr(2, 9);

export default function PlayerLobby() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);

  const joinGame = () => {
    if (!name.trim()) return;
    // Use sessionStorage so that each tab gets its own identity.
    let playerId = sessionStorage.getItem('playerId');
    if (!playerId) {
      playerId = generatePlayerId();
      sessionStorage.setItem('playerId', playerId);
    }
    sessionStorage.setItem('playerName', name);
    socket.emit('joinGame', { gameId, playerName: name, playerId });
    setJoined(true);
  };

  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('gameState', (state) => {
      console.log('Received game state:', state);
      setGameState(state);
      // Navigate to game view if game has started.
      if (state.status === 'questionActive' || state.status === 'answered') {
        console.log('Game has started, navigating to game screen');
        navigate(`/game/${gameId}`);
      }
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
    });

    return () => newSocket.disconnect();
  }, [gameId, navigate]);

  return (
    <div className="max-w-md mx-auto p-6">
      {!joined ? (
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border rounded"
          />
          <button
            onClick={joinGame}
            className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
          >
            Join Game
          </button>
        </div>
      ) : (
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Waiting for host to start...</h1>
          <p className="text-gray-600">
            Players joined: {gameState?.players?.length || 0}
          </p>
        </div>
      )}
    </div>
  );
}
