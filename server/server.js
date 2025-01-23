import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import crypto from 'crypto';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Game state storage
const activeGames = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to get public game state
const getPublicGameState = (game) => ({
  status: game.state,
  players: Array.from(game.players.values()),
  currentQuestion: game.currentQuestion,
  currentRound: game.currentRound || 1
});

// REST API Endpoints
app.post('/api/games', (req, res) => {
  try {
    const gameConfig = req.body;
    if (!gameConfig) throw new Error("Invalid game configuration");

    const gameId = crypto.randomUUID().slice(0, 6).toUpperCase();
    
    activeGames.set(gameId, {
      config: gameConfig,
      players: new Map(),
      state: 'lobby',
      hostSocket: null,
      currentRound: 1,
      currentQuestion: null,
      currentBuzzer: null
    });

    console.log(`Game created: ${gameId}`);
    res.status(201).json({ gameId });
  } catch (error) {
    console.error("Game creation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// WebSocket Handlers
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('hostJoin', (gameId) => {
    try {
      const game = activeGames.get(gameId);
      if (!game) throw new Error("Game not found");
      
      game.hostSocket = socket.id;
      socket.join(gameId);
      console.log(`Host joined: ${gameId}`);
      socket.emit('gameState', getPublicGameState(game));
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('joinGame', ({ gameId, playerName }) => {
    try {
      const game = activeGames.get(gameId);
      if (!game) throw new Error("Game not found");
      if (game.state !== 'lobby') throw new Error("Game has already started");

      const playerData = {
        id: socket.id,
        name: playerName,
        score: 0,
        hasBuzzed: false
      };

      game.players.set(socket.id, playerData);
      socket.join(gameId);
      
      console.log(`Player joined: ${playerName} (${socket.id}) in ${gameId}`);
      io.to(gameId).emit('gameState', getPublicGameState(game));
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('startGame', (gameId) => {
    try {
      const game = activeGames.get(gameId);
      if (!game) throw new Error("Game not found");
      if (socket.id !== game.hostSocket) throw new Error("Unauthorized");

      game.state = 'playing';
      game.currentQuestion = 0;
      io.to(gameId).emit('gameState', getPublicGameState(game));
      console.log(`Game started: ${gameId}`);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('advanceQuestion', (gameId) => {
    try {
      const game = activeGames.get(gameId);
      if (!game) throw new Error("Game not found");
      if (socket.id !== game.hostSocket) throw new Error("Unauthorized");

      game.currentQuestion++;
      game.currentBuzzer = null;
      game.state = 'questionActive';
      
      // Reset player buzz states
      game.players.forEach(player => {
        player.hasBuzzed = false;
      });

      io.to(gameId).emit('gameState', getPublicGameState(game));
      console.log(`Question advanced to ${game.currentQuestion} in ${gameId}`);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('buzz', (gameId) => {
    try {
      const game = activeGames.get(gameId);
      if (!game) throw new Error("Game not found");
      if (game.state !== 'questionActive') throw new Error("Buzzing not allowed now");

      const player = game.players.get(socket.id);
      if (!player) throw new Error("Player not registered");
      if (player.hasBuzzed) throw new Error("Already buzzed");

      if (!game.currentBuzzer) {
        game.currentBuzzer = socket.id;
        player.hasBuzzed = true;
        io.to(gameId).emit('gameState', getPublicGameState(game));
        socket.emit('buzzAcknowledged', { success: true });
        console.log(`Buzz received from ${player.name} in ${gameId}`);
      } else {
        socket.emit('buzzAcknowledged', { success: false });
      }
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});