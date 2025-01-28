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
    <div>
      <h1>Round {gameState.currentRound}</h1>
      <h2>Your Score: {gameState.players.find(p => p.id === socket.id)?.score || 0}</h2>
      <h2>Current Question</h2>
      {gameState.currentQuestionObj ? (
        <div>
          <p>{gameState.currentQuestionObj.category}</p>
          <p>{gameState.currentQuestionObj.text}</p>
          <button onClick={handleBuzz} disabled={playerState.hasBuzzed}>
            {playerState.hasBuzzed ? 'BUZZED IN!' : 'BUZZ!'}
          </button>
        </div>
      ) : (
        <p>Waiting for host to start the next question...</p>
      )}
      <h2>Players</h2>
      <ul>
        {gameState.players.map(player => (
          <li key={player.id}>
            {player.name} - {player.score} pts
          </li>
        ))}
      </ul>
    </div>
  );
}