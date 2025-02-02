import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

export default function GamePlay() {
  const { gameId } = useParams();
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [playerState, setPlayerState] = useState({
    hasBuzzed: false,
    canAnswer: false,
    buzzMessage: '',
    answerFeedback: ''
  });
  const [answer, setAnswer] = useState('');

  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    console.log('Socket initialized');
    setSocket(newSocket);

    // Retrieve identity from sessionStorage (unique per tab)
    const playerName = sessionStorage.getItem('playerName');
    const playerId = sessionStorage.getItem('playerId');
    newSocket.emit('joinGame', { gameId, playerName, playerId, rejoin: true });
    console.log('Emitted joinGame event');

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
    });

    newSocket.on('gameState', (state) => {
      console.log('Received game state:', state);
      setGameState(state);
      setPlayerState(prev => ({ ...prev, answerFeedback: '' }));
      // If not our turn to answer, disable answer form.
      if (state.currentAnswerer !== playerId) {
        setPlayerState(prev => ({ ...prev, canAnswer: false }));
      }
      // Reset buzz status when a new question begins.
      if (state.status === 'questionActive') {
        setPlayerState(prev => ({ ...prev, hasBuzzed: false, buzzMessage: '' }));
      }
    });

    newSocket.on('allowAnswer', () => {
      console.log('Received allowAnswer event');
      setPlayerState(prev => ({ ...prev, canAnswer: true, buzzMessage: "It's your turn to answer!" }));
    });

    newSocket.on('buzzAcknowledged', (data) => {
      console.log('Buzz acknowledgment:', data);
      if (data.success) {
        setPlayerState(prev => ({ ...prev, hasBuzzed: true, buzzMessage: data.message }));
      } else {
        setPlayerState(prev => ({ ...prev, buzzMessage: data.message }));
      }
    });

    newSocket.on('answerResult', (data) => {
      console.log('Answer result:', data);
      setPlayerState(prev => ({ ...prev, answerFeedback: data.message, canAnswer: false }));
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
      socket.emit('submitAnswer', { gameId, answer: answer.trim() });
      setAnswer('');
    }
  };

  const getCurrentPlayer = () => {
    // Find the player by matching the socket id with the stored socket id in the game state.
    return gameState?.players.find(p => p.socketId === socket.id);
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
                    playerState.hasBuzzed ? 'bg-gray-300' : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {playerState.hasBuzzed ? 'BUZZED!' : 'BUZZ TO ANSWER'}
                </button>
              )}

              {playerState.buzzMessage && (
                <div className="mt-4 p-3 rounded-lg text-center bg-yellow-100 text-yellow-800">
                  {playerState.buzzMessage}
                </div>
              )}

              {playerState.answerFeedback && (
                <div className={`mt-4 p-3 rounded-lg text-center ${
                  playerState.answerFeedback.includes("Correct")
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {playerState.answerFeedback}
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Players</h2>
            <div className="space-y-2">
              {gameState.players.map(player => (
                <div
                  key={player.playerId}
                  className={`flex justify-between p-3 rounded-lg ${
                    player.socketId === socket.id ? 'bg-purple-100' : 'bg-gray-50'
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
