import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';


export default function PlayerLobby() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const [name, setName] = useState('');
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);

  const joinGame = () => {
    localStorage.setItem('playerName', name);
    socket.emit('joinGame', { 
      gameId,
      playerName: name
    });
};



  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('gameState', (state) => {
      console.log('Received game state:', state); // Debug log
      setGameState(state);
      if (state.status === 'playing') {
        console.log('Game is starting, navigating to game screen'); // Debug log
        navigate(`/game/${gameId}`);
      }
    });

    // Add connection event
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
    });

    return () => newSocket.disconnect();
}, [gameId, navigate]);


  return (
    <div className="max-w-md mx-auto p-6">
      {!gameState?.players?.some(p => p.name === name) ? (
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
          <p className="text-gray-600">Players joined: {gameState.players.length}</p>
        </div>
      )}
    </div>
  );
}