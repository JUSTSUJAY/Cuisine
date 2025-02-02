import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import crypto from 'crypto';
import axios from 'axios';
import loadEnv from '../envLoader.js';

// Load environment variables
const env = loadEnv();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Game state storage
// Each game will store players in a Map keyed by persistent playerId.
const activeGames = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to get public game state
const getPublicGameState = (game) => ({
  status: game.state,
  players: Array.from(game.players.values()),
  currentRound: game.currentRound || 1,
  currentQuestion: game.currentQuestionObj,
  currentCategory: game.quizContent.quizData.rounds[game.currentRound - 1].categories[0].name,
  buzzerQueue: game.buzzerQueue,
  currentAnswerer: game.currentAnswerer || null,
  questionTimedOut: game.questionTimedOut || false
});

// Function to generate quiz content using an LLM
const generateQuizContent = async (config) => {
  const { rounds, categoriesPerRound, questionsPerCategory } = config;
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Generate quiz content for ${rounds} rounds with ${categoriesPerRound} categories per round and ${questionsPerCategory} questions per category. Each category should have a name, description, and open-ended questions with clear answers. Return the output as a JSON object with the following structure:
{
  "potentialCategories": [
    { "name": "Category Name", "description": "Category Description" }
  ],
  "quizData": {
    "rounds": [
      {
        "roundNumber": 1,
        "categories": [
          {
            "name": "Category Name",
            "questions": [
              { "question": "Question Text", "answer": "Answer" }
            ]
          }
        ]
      }
    ]
  }
}
`
        },
        {
          role: "user",
          content: `Generate ${rounds} rounds of quiz content with ${categoriesPerRound} categories per round and ${questionsPerCategory} questions per category. Each category should have a name and description. Each question should be open-ended with a clear answer.`
        }
      ],
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    console.log("Raw Quiz Content:", response.data.choices[0].message.content);
    const quizData = JSON.parse(response.data.choices[0].message.content);
    console.log("Parsed Quiz Content:", quizData);
    return quizData;
  } catch (error) {
    console.error("Failed to generate quiz content:", error.response?.data || error.message);
    throw new Error("Failed to generate quiz content. Please check your OpenAI API configuration.");
  }
};

// REST API Endpoint to create a new game
app.post('/api/games', async (req, res) => {
  try {
    const gameConfig = req.body;
    if (!gameConfig) throw new Error("Invalid game configuration");
    const gameId = crypto.randomUUID().slice(0, 6).toUpperCase();

    // Generate quiz content using the LLM
    const quizContent = await generateQuizContent(gameConfig);

    if (!quizContent.quizData || !Array.isArray(quizContent.quizData.rounds)) {
      throw new Error("Invalid quiz content structure.");
    }

    const initialGameState = {
      config: gameConfig,
      quizContent,
      // Players stored in a Map keyed by persistent playerId.
      players: new Map(),
      state: 'lobby',
      hostSocket: null,
      currentRound: 1,
      currentQuestionIndex: 0,
      // Use an ordered buzzer queue that stores persistent playerIds.
      buzzerQueue: [],
      currentAnswerer: null,
      questionTimedOut: false,
      currentQuestionObj: quizContent.quizData.rounds[0].categories[0].questions[0],
      questionTimer: null
    };

    activeGames.set(gameId, initialGameState);
    console.log(`Game created: ${gameId}`);
    res.status(201).json({ gameId });
  } catch (error) {
    console.error("Game creation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start a timer for the current question (15 seconds)
const startQuestionTimer = (game, gameId) => {
  if (game.questionTimer) clearTimeout(game.questionTimer);
  game.questionTimer = setTimeout(() => {
    if (game.state === 'questionActive') {
      game.state = 'answered';
      game.questionTimedOut = true;
      io.to(gameId).emit('gameState', getPublicGameState(game));
      console.log(`Question timed out in game ${gameId}`);
    }
  }, 15000);
};

// WebSocket Handlers
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Host joining
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

  // Player joining (or rejoining)
  // Expect: { gameId, playerName, playerId, rejoin }
  socket.on('joinGame', ({ gameId, playerName, playerId, rejoin }) => {
    try {
      const game = activeGames.get(gameId);
      if (!game) throw new Error("Game not found");
      if (game.state !== 'lobby' && !rejoin)
        throw new Error("Game has already started");

      // Save the persistent playerId on the socket for later use.
      socket.playerId = playerId;

      // If a player with this persistent id already exists, update their socketId.
      if (game.players.has(playerId)) {
        const existingPlayer = game.players.get(playerId);
        existingPlayer.socketId = socket.id;
        // (Optionally update the name if it changed)
        existingPlayer.name = playerName;
      } else {
        // Otherwise, create a new entry.
        const playerData = {
          playerId,
          name: playerName,
          socketId: socket.id,
          score: 0,
          hasBuzzed: false
        };
        game.players.set(playerId, playerData);
      }
      socket.join(gameId);
      io.to(gameId).emit('gameState', getPublicGameState(game));
      console.log(`Player joined: ${playerName} (${playerId}) in ${gameId}`);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  // Host starts the game.
  socket.on('startGame', (gameId) => {
    try {
      const game = activeGames.get(gameId);
      if (!game) throw new Error("Game not found");
      if (socket.id !== game.hostSocket) throw new Error("Unauthorized");

      game.state = 'questionActive';
      game.currentRound = 1;
      game.currentQuestionIndex = 0;
      game.buzzerQueue = [];
      game.currentAnswerer = null;
      game.questionTimedOut = false;
      game.currentQuestionObj = game.quizContent.quizData.rounds[0].categories[0].questions[0];

      io.to(gameId).emit('gameState', getPublicGameState(game));
      console.log(`Game started: ${gameId} with question:`, game.currentQuestionObj);
      startQuestionTimer(game, gameId);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });
  
  // Host advances to the next question.
  socket.on('advanceQuestion', (gameId) => {
    try {
      const game = activeGames.get(gameId);
      if (!game) throw new Error("Game not found");
      if (socket.id !== game.hostSocket) throw new Error("Unauthorized");

      if (game.questionTimer) clearTimeout(game.questionTimer);

      // Reset each player's buzz flag.
      game.players.forEach(player => {
        player.hasBuzzed = false;
      });
      game.buzzerQueue = [];
      game.currentAnswerer = null;
      game.questionTimedOut = false;

      game.currentQuestionIndex++;
      game.currentQuestionObj = getCurrentQuestion(game);
      game.state = 'questionActive';

      io.to(gameId).emit('gameState', getPublicGameState(game));
      console.log(`Advanced to question index ${game.currentQuestionIndex} in game ${gameId}`);
      startQuestionTimer(game, gameId);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  // Handle buzzing
  socket.on('buzz', (gameId) => {
    try {
      const game = activeGames.get(gameId);
      if (!game) throw new Error("Game not found");
      if (game.state !== 'questionActive') throw new Error("Buzzing not allowed now");

      const pid = socket.playerId;
      if (!pid) throw new Error("Player identification missing");

      const player = game.players.get(pid);
      if (!player) throw new Error("Player not registered");

      // Prevent duplicate buzzes by persistent playerId.
      if (game.buzzerQueue.includes(pid)) {
        socket.emit('buzzAcknowledged', { success: false, message: "You already buzzed." });
        return;
      }

      game.buzzerQueue.push(pid);
      player.hasBuzzed = true;
      io.to(gameId).emit('gameState', getPublicGameState(game));
      socket.emit('buzzAcknowledged', { success: true, message: "Buzz registered." });
      console.log(`Buzz from ${player.name} in ${gameId}. Queue: ${game.buzzerQueue}`);

      // If this is the first buzz, mark this player as the current answerer.
      if (game.buzzerQueue.length === 1) {
        game.currentAnswerer = pid;
        // Send allowAnswer to that player's current socket.
        const targetSocketId = game.players.get(pid).socketId;
        io.to(targetSocketId).emit('allowAnswer');
      }
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  // Handle answer submission.
  socket.on('submitAnswer', ({ gameId, answer }) => {
    try {
      const game = activeGames.get(gameId);
      if (!game) throw new Error("Game not found");
      const pid = socket.playerId;
      if (!pid) throw new Error("Player identification missing");

      if (!game.currentAnswerer || game.currentAnswerer !== pid) {
        socket.emit('error', 'Not your turn to answer.');
        return;
      }

      const correctAnswer = game.currentQuestionObj.answer.trim().toLowerCase();
      const submittedAnswer = answer.trim().toLowerCase();
      const player = game.players.get(pid);

      if (submittedAnswer === correctAnswer) {
        player.score += 10;
        game.state = 'answered';
        game.currentAnswerer = null;
        game.buzzerQueue = [];
        io.to(gameId).emit('gameState', getPublicGameState(game));
        socket.emit('answerResult', { correct: true, message: "Correct answer!" });
        console.log(`${player.name} answered correctly in game ${gameId}.`);
        if (game.questionTimer) clearTimeout(game.questionTimer);
      } else {
        player.score -= 10;
        socket.emit('answerResult', { correct: false, message: "Incorrect answer!" });
        console.log(`${player.name} answered incorrectly in game ${gameId}.`);
        // Remove this player from the queue.
        game.buzzerQueue = game.buzzerQueue.filter(id => id !== pid);
        if (game.buzzerQueue.length > 0) {
          game.currentAnswerer = game.buzzerQueue[0];
          io.to(gameId).emit('gameState', getPublicGameState(game));
          const nextSocketId = game.players.get(game.currentAnswerer).socketId;
          io.to(nextSocketId).emit('allowAnswer');
        } else {
          game.currentAnswerer = null;
          game.state = 'answered';
          io.to(gameId).emit('gameState', getPublicGameState(game));
        }
      }
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // (Optional) You can implement logic here to remove a player if desired.
  });
});

// Helper to get the current question.
const getCurrentQuestion = (game) => {
  const { quizContent, currentRound, currentQuestionIndex } = game;
  if (!quizContent || !quizContent.quizData || !Array.isArray(quizContent.quizData.rounds)) {
    console.error("Invalid quiz content:", quizContent);
    return null;
  }
  const roundIndex = currentRound - 1;
  if (roundIndex < 0 || roundIndex >= quizContent.quizData.rounds.length) {
    console.error("Invalid round index:", roundIndex);
    return null;
  }
  const round = quizContent.quizData.rounds[roundIndex];
  const questions = round.categories.flatMap(cat => cat.questions);
  if (currentQuestionIndex < 0 || currentQuestionIndex >= questions.length) {
    console.error("Invalid question index:", currentQuestionIndex);
    return null;
  }
  const question = questions[currentQuestionIndex];
  console.log("Current Question:", question);
  return question;
};

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
