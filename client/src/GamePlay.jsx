// client/src/GamePlay.jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

export default function GamePlay() {
  const { gameId } = useParams();
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [playerState, setPlayerState] = useState({
    hasBuzzed: false,
    lastAnswerCorrect: null
  });

  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('gameState', (state) => {
      setGameState(state);
      setPlayerState(prev => ({
        ...prev,
        hasBuzzed: false,
        lastAnswerCorrect: null
      }));
    });

    newSocket.on('buzzAcknowledged', ({ success }) => {
      setPlayerState(prev => ({
        ...prev,
        hasBuzzed: success,
        lastAnswerCorrect: null
      }));
    });

    newSocket.on('answerResult', ({ correct }) => {
      setPlayerState(prev => ({
        ...prev,
        lastAnswerCorrect: correct
      }));
    });

    return () => newSocket.disconnect();
  }, [gameId]);

  const handleBuzz = () => {
    if (!playerState.hasBuzzed) {
      socket.emit('buzz', gameId);
    }
  };

  if (!gameState) return <div>Loading game...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">
            Round {gameState.currentRound}
          </h1>
          <div className="bg-white px-4 py-2 rounded-lg shadow">
            <span className="font-mono text-lg">Your Score: {gameState.players.find(p => p.id === socket.id)?.score || 0}</span>
          </div>
        </div>

        {/* Question Display */}
        {gameState.currentQuestion ? (
          <div className="mb-8">
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                {gameState.currentQuestion.category}
              </h2>
              <p className="text-2xl font-medium text-gray-900">
                {gameState.currentQuestion.text}
              </p>
            </div>

            {/* Buzzer Interface */}
            {gameState.status === 'questionActive' && (
              <div className="text-center">
                <button
                  onClick={handleBuzz}
                  disabled={playerState.hasBuzzed}
                  className={`buzzer-button ${playerState.hasBuzzed ? 'bg-gray-400' : 'bg-red-500 hover:bg-red-600'} 
                    text-white text-3xl font-bold py-8 px-16 rounded-full transition-all`}
                >
                  {playerState.hasBuzzed ? 'BUZZED IN!' : 'BUZZ!'}
                </button>
              </div>
            )}

            {/* Answer Feedback */}
            {playerState.lastAnswerCorrect !== null && (
              <div className={`mt-6 p-4 rounded-lg text-center text-lg ${
                playerState.lastAnswerCorrect 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {playerState.lastAnswerCorrect 
                  ? 'Correct! +100 points' 
                  : 'Incorrect! -50 points'}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-xl text-gray-500">
            Waiting for host to start the next question...
          </div>
        )}

        {/* Players List */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-4">Players</h3>
          <div className="grid grid-cols-2 gap-4">
            {gameState.players.map(player => (
              <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span>{player.name}</span>
                <span className="font-mono">{player.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}