import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

export default function GamePlay() {
  const { gameId } = useParams();
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [playerState, setPlayerState] = useState({
    hasBuzzed: false,
    lastAnswerCorrect: null,
    canAnswer: false
  });
  const [answer, setAnswer] = useState('');

  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    console.log('Socket initialized');
    setSocket(newSocket);

    // Keep the player's name when transitioning from lobby
    const playerName = localStorage.getItem('playerName');
    
    newSocket.emit('joinGame', { 
      gameId,
      playerName,
      rejoin: true 
    });
    console.log('Emitted joinGame event');

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
    });

    newSocket.on('gameState', (state) => {
      console.log('Received game state:', state);
      setGameState(state);
    });

    return () => newSocket.disconnect();
  }, [gameId]);

  const handleBuzz = () => {
    if (!playerState.hasBuzzed && socket) {
      socket.emit('buzz', gameId);
    }
  };

  const handleAnswerSubmit = (e) => {
    e.preventDefault();
    if (playerState.canAnswer && answer.trim() && socket) {
      socket.emit('submitAnswer', {
        gameId,
        answer: answer.trim()
      });
      setAnswer('');
    }
  };

  const getCurrentPlayer = () => {
    return gameState?.players.find(p => p.id === socket.id);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {gameState ? (
        <>
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Round {gameState.currentRound}</h1>
            <div className="bg-purple-100 p-4 rounded-lg">
              <h2 className="text-xl">Score: {getCurrentPlayer()?.score || 0}</h2>
            </div>
          </div>

          {gameState.currentQuestion && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <div className="mb-4">
                <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-sm">
                  {gameState.currentCategory}
                </span>
              </div>
              
              <p className="text-xl mb-6">{gameState.currentQuestion.question}</p>

              {playerState.canAnswer ? (
                <form onSubmit={handleAnswerSubmit} className="space-y-4">
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Your answer..."
                    className="w-full p-3 border rounded-lg"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-bold"
                  >
                    Submit Answer
                  </button>
                </form>
              ) : (
                <button
                  onClick={handleBuzz}
                  disabled={playerState.hasBuzzed}
                  className={`w-full py-4 rounded-lg font-bold text-lg ${
                    playerState.hasBuzzed
                      ? 'bg-gray-300'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {playerState.hasBuzzed ? 'BUZZED!' : 'BUZZ TO ANSWER'}
                </button>
              )}

              {playerState.lastAnswerCorrect !== null && (
                <div className={`mt-4 p-3 rounded-lg text-center ${
                  playerState.lastAnswerCorrect
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {playerState.lastAnswerCorrect ? 'Correct!' : 'Incorrect!'}
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Players</h2>
            <div className="space-y-2">
              {gameState.players.map(player => (
                <div
                  key={player.id}
                  className={`flex justify-between p-3 rounded-lg ${
                    player.id === socket.id ? 'bg-purple-100' : 'bg-gray-50'
                  }`}
                >
                  <span>{player.name}</span>
                  <span className="font-bold">{player.score} pts</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-lg">Loading game state...</p>
          </div>
        </div>
      )}
    </div>
  );
}
