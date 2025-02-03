// client/src/HostPanel.jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

export default function HostPanel() {
  const { gameId } = useParams();
  const [gameState, setGameState] = useState(null);
  const [socket, setSocket] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);

  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    newSocket.emit('hostJoin', gameId);
    newSocket.on('gameState', (state) => {
      setGameState(state);
      setRemainingTime(state.remainingTime || 0);
      // For host, do not auto-navigate; they always stay here.
    });
    newSocket.on('timerUpdate', ({ remainingTime }) => {
      setRemainingTime(remainingTime);
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

  const pauseGame = () => {
    socket.emit('pauseGame', gameId);
  };

  const resumeGame = () => {
    socket.emit('resumeGame', gameId);
  };

  // Determine which control buttons to show based on the game state.
  // When the game is paused, show the "Resume Game" button.
  // When the game is running (questionActive or answered), show "Pause Game" (and Next if answered).
  const renderControls = () => {
    if (!gameState) return null;

    if (gameState.status === 'lobby') {
      return (
        <div className="mb-4">
          <button onClick={startGame} className="bg-green-500 text-white px-4 py-2 rounded">
            Start Game
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-4 mb-4">
        <div className="mb-2 text-lg font-bold">
          Time Remaining: {remainingTime}s
        </div>
        <div className="flex gap-4">
          {gameState.status === 'paused' ? (
            <button onClick={resumeGame} className="bg-green-500 text-white px-4 py-2 rounded">
              Resume Game
            </button>
          ) : (
            <button onClick={pauseGame} className="bg-orange-500 text-white px-4 py-2 rounded">
              Pause Game
            </button>
          )}
          {gameState.status !== 'paused' && (
            <button onClick={nextQuestion} className="bg-blue-500 text-white px-4 py-2 rounded">
              Next Question
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Hosting Game: {gameId}</h1>

      <div className="mb-4 p-4 bg-gray-100 rounded">
        <h2 className="font-bold mb-2">Player Join Link:</h2>
        <p className="text-blue-600">{`${window.location.origin}/play/${gameId}`}</p>
      </div>

      {renderControls()}

      {gameState &&
        (gameState.status === 'questionActive' ||
          gameState.status === 'answered' ||
          gameState.status === 'paused') && (
          <div className="mb-4">
            <div className="bg-white p-4 rounded shadow mb-4">
              <h3 className="font-bold">Category: {gameState.currentCategory}</h3>
              <p className="text-lg my-2">{gameState.currentQuestion.question}</p>
              {gameState.status === 'answered' && (
                <p className="text-green-600 font-bold">
                  Correct Answer: {gameState.currentQuestion.answer}
                </p>
              )}
              {gameState.questionTimedOut && (
                <p className="text-red-600 font-bold">Time's up! No answer.</p>
              )}
            </div>
          </div>
        )}

      <div className="mt-4">
        <h2 className="text-xl font-bold mb-2">
          Players ({gameState?.players?.length || 0})
        </h2>
        <div className="bg-white rounded shadow p-4">
          {gameState && gameState.players.length === 0 ? (
            <p>Share the join link above to invite players!</p>
          ) : (
            <ul className="space-y-2">
              {gameState &&
                gameState.players.map((player) => (
                  <li key={player.playerId} className="flex justify-between">
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
