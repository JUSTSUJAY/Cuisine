import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

// client/HostPanel.jsx

export default function HostPanel() {
  const { gameId } = useParams();
  const [gameState, setGameState] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    newSocket.emit('hostJoin', gameId);
    newSocket.on('gameState', (state) => {
      setGameState(state);
    });
    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, [gameId]);

  const startGame = () => {
    socket.emit('startGame', gameId);
  };

  const nextQuestion = () => {
    socket.emit('advanceQuestion', gameId);
  };

  if (!gameState) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Hosting Game: {gameId}</h1>

      <div className="mb-4 p-4 bg-gray-100 rounded">
      <h2 className="font-bold mb-2">Player Join Link:</h2>
      <p className="text-blue-600">
        {`${window.location.origin}/play/${gameId}`}
      </p>
    </div>
      
      {gameState.status === 'lobby' && (
        <div className="mb-4">
          <button 
            onClick={startGame}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Start Game
          </button>
        </div>
      )}
  
      {gameState.status === 'playing' && (
        <div className="mb-4">
          <div className="bg-white p-4 rounded shadow mb-4">
            <h3 className="font-bold">Category: {gameState.currentCategory}</h3>
            <p className="text-lg my-2">{gameState.currentQuestion.question}</p>
            <p className="text-green-600">Answer: {gameState.currentQuestion.answer}</p>
          </div>
          <button 
            onClick={nextQuestion}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Next Question
          </button>
        </div>
      )}
  
  <div className="mt-4">
  <h2 className="text-xl font-bold mb-2">Players ({gameState.players.length})</h2>
  <div className="bg-white rounded shadow p-4">
    {gameState.players.length === 0 ? (
      <p>Share the join link above to invite players!</p>
    ) : (
      <ul className="space-y-2">
        {gameState.players.map(player => (
          <li key={player.id} className="flex justify-between">
            <span>{player.name}</span>
            <span>{player.score} pts</span>
          </li>
        ))}
      </ul>
    )}
  </div>
</div>

    </div>
  );
   
}