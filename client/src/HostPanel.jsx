import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

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
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between mb-8">
        <h1 className="text-2xl font-bold">Hosting Game: {gameId}</h1>
        <div className="space-x-4">
          {gameState.status === 'lobby' && (
            <button 
              onClick={startGame}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Start Game
            </button>
          )}
          {gameState.status === 'playing' && (
            <button
              onClick={nextQuestion}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Next Question
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Players</h2>
          <div className="space-y-2">
            {gameState.players.map(player => (
              <div key={player.id} className="flex justify-between items-center p-3 bg-gray-100 rounded">
                <span>{player.name}</span>
                <span className="font-mono">{player.score} pts</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Current Question</h2>
          {gameState.currentQuestion && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-lg font-medium mb-2">
                {gameState.currentQuestion.text}
              </p>
              <p className="text-sm text-gray-600">
                Answer: {gameState.currentQuestion.answer}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}