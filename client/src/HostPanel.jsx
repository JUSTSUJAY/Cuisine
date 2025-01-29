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
    <div>
      <h1>Hosting Game: {gameId}</h1>
      {gameState.status === 'lobby' && <button onClick={startGame}>Start Game</button>}
      {gameState.status === 'playing' && <button onClick={nextQuestion}>Next Question</button>}
      <h2>Players</h2>
      <ul>
        {gameState.players.map(player => (
          <li key={player.id}>
            {player.name} - {player.score} pts
          </li>
        ))}
      </ul>
      <h2>Current Question</h2>
      {gameState.currentQuestion ? (
        <div>
          <p>{gameState.currentQuestion.question}</p>
          <p><strong>Answer:</strong> {gameState.currentQuestion.answer}</p>
        </div>
      ) : (
        <p>No questions available. Please check the quiz configuration.</p>
      )}
    </div>
  );
}