// server.js
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

// Game state storage – players keyed by persistent playerId
const activeGames = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Helper: Get public game state (sorted players for leaderboard)
const getPublicGameState = (game) => ({
  status: game.state,
  players: Array.from(game.players.values()).sort((a, b) => b.score - a.score),
  currentRound: game.currentRound || 1,
  currentQuestion: game.currentQuestionObj,
  currentCategory: game.quizContent.quizData.rounds[game.currentRound - 1].categories[0].name,
  buzzerQueue: game.buzzerQueue,
  currentAnswerer: game.currentAnswerer || null,
  questionTimedOut: game.questionTimedOut || false,
  remainingTime: game.remainingTime || 0,
  chatMessages: game.chatMessages || []
});

// Function to generate quiz content using an LLM
const generateQuizContent = async (config) => {
  const { rounds, categoriesPerRound, questionsPerCategory } = config;
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
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
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
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

    const quizContent = await generateQuizContent(gameConfig);
    if (!quizContent.quizData || !Array.isArray(quizContent.quizData.rounds)) {
      throw new Error("Invalid quiz content structure.");
    }

    const initialGameState = {
      config: gameConfig,
      quizContent,
      players: new Map(),
      state: 'lobby',
      hostSocket: null,
      currentRound: 1,
      currentQuestionIndex: 0,
      buzzerQueue: [],
      currentAnswerer: null,
      questionTimedOut: false,
      currentQuestionObj: quizContent.quizData.rounds[0].categories[0].questions[0],
      timerInterval: null,  // will store the current timer interval id
      remainingTime: 0,       // updated per timer phase
      chatMessages: []
    };

    activeGames.set(gameId, initialGameState);
    console.log(`Game created: ${gameId}`);
    res.status(201).json({ gameId });
  } catch (error) {
    console.error("Game creation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Timer Functions
// Start the Buzz Timer (15 seconds): countdown during which players may buzz.
const startBuzzTimer = (game, gameId) => {
  if (game.timerInterval) clearInterval(game.timerInterval);
  game.remainingTime = 15;
  io.to(gameId).emit('timerUpdate', { remainingTime: game.remainingTime });
  game.timerInterval = setInterval(() => {
    if (game.state !== 'questionActive') {
      clearInterval(game.timerInterval);
      return;
    }
    game.remainingTime -= 1;
    io.to(gameId).emit('timerUpdate', { remainingTime: game.remainingTime });
    if (game.remainingTime <= 0) {
      clearInterval(game.timerInterval);
      game.state = 'answered';
      game.questionTimedOut = true;
      io.to(gameId).emit('gameState', getPublicGameState(game));
      console.log(`Buzz timer expired in game ${gameId}`);
    }
  }, 1000);
};

// Start the Answer Timer (10 seconds): countdown for the active answerer.
const startAnswerTimer = (game, gameId) => {
  if (game.timerInterval) clearInterval(game.timerInterval);
  game.remainingTime = 10;
  io.to(gameId).emit('timerUpdate', { remainingTime: game.remainingTime });
  game.timerInterval = setInterval(() => {
    if (game.state !== 'questionActive') {
      clearInterval(game.timerInterval);
      return;
    }
    game.remainingTime -= 1;
    io.to(gameId).emit('timerUpdate', { remainingTime: game.remainingTime });
    if (game.remainingTime <= 0) {
      clearInterval(game.timerInterval);
      game.state = 'answered';
      game.questionTimedOut = true;
      io.to(gameId).emit('gameState', getPublicGameState(game));
      console.log(`Answer timer expired in game ${gameId}`);
    }
  }, 1000);
};

// Pause and Resume functions.
const pauseGame = (game, gameId) => {
  if (game.timerInterval) {
    clearInterval(game.timerInterval);
    game.timerInterval = null;
  }
  game.state = 'paused';
  io.to(gameId).emit('gameState', getPublicGameState(game));
  console.log(`Game ${gameId} paused at ${game.remainingTime}s remaining.`);
};

const resumeGame = (game, gameId) => {
  // Determine which timer phase to resume: if someone has buzzed, resume answer timer; otherwise, resume buzz timer.
  if (game.buzzerQueue.length > 0) {
    game.state = 'questionActive';
    io.to(gameId).emit('gameState', getPublicGameState(game));
    startAnswerTimer(game, gameId);
  } else {
    game.state = 'questionActive';
    io.to(gameId).emit('gameState', getPublicGameState(game));
    startBuzzTimer(game, gameId);
  }
  console.log(`Game ${gameId} resumed with ${game.remainingTime}s remaining.`);
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
  socket.on('joinGame', ({ gameId, playerName, playerId, avatar, rejoin }) => {
    try {
      const game = activeGames.get(gameId);
      if (!game) throw new Error("Game not found");
      if (game.state !== 'lobby' && !rejoin)
        throw new Error("Game has already started");

      socket.playerId = playerId;
      if (game.players.has(playerId)) {
        const existingPlayer = game.players.get(playerId);
        existingPlayer.socketId = socket.id;
        existingPlayer.name = playerName;
        if (avatar) existingPlayer.avatar = avatar;
      } else {
        const playerData = {
          playerId,
          name: playerName,
          socketId: socket.id,
          score: 0,
          hasBuzzed: false,
          avatar: avatar || null
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
      // Instead of starting answer timer immediately, start the buzz timer.
      startBuzzTimer(game, gameId);
      io.to(gameId).emit('gameState', getPublicGameState(game));
      console.log(`Game started: ${gameId} with question:`, game.currentQuestionObj);
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

      if (game.timerInterval) clearInterval(game.timerInterval);

      game.players.forEach(player => {
        player.hasBuzzed = false;
      });
      game.buzzerQueue = [];
      game.currentAnswerer = null;
      game.questionTimedOut = false;
      game.currentQuestionIndex++;
      game.currentQuestionObj = getCurrentQuestion(game);
      game.state = 'questionActive';
      // Start buzz timer for the new question.
      startBuzzTimer(game, gameId);
      io.to(gameId).emit('gameState', getPublicGameState(game));
      console.log(`Advanced to question index ${game.currentQuestionIndex} in game ${gameId}`);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  // Host pause and resume events.
  socket.on('pauseGame', (gameId) => {
    try {
      const game = activeGames.get(gameId);
      if (!game) throw new Error("Game not found");
      if (socket.id !== game.hostSocket) throw new Error("Unauthorized");
      pauseGame(game, gameId);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });
  socket.on('resumeGame', (gameId) => {
    try {
      const game = activeGames.get(gameId);
      if (!game) throw new Error("Game not found");
      if (socket.id !== game.hostSocket) throw new Error("Unauthorized");
      resumeGame(game, gameId);
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

      if (game.buzzerQueue.includes(pid)) {
        socket.emit('buzzAcknowledged', { success: false, message: "You already buzzed." });
        return;
      }

      game.buzzerQueue.push(pid);
      player.hasBuzzed = true;
      io.to(gameId).emit('gameState', getPublicGameState(game));
      socket.emit('buzzAcknowledged', { success: true, message: "Buzz registered." });
      console.log(`Buzz from ${player.name} in ${gameId}. Queue: ${game.buzzerQueue}`);

      // If first buzz, clear buzz timer and start answer timer.
      if (game.buzzerQueue.length === 1) {
        game.currentAnswerer = pid;
        if (game.timerInterval) clearInterval(game.timerInterval);
        startAnswerTimer(game, gameId);
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
        if (game.timerInterval) clearInterval(game.timerInterval);
      } else {
        player.score -= 10;
        socket.emit('answerResult', { correct: false, message: "Incorrect answer!" });
        console.log(`${player.name} answered incorrectly in game ${gameId}.`);
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

  // Chat Message Handling
  socket.on('chatMessage', ({ gameId, senderName, message }) => {
    try {
      const game = activeGames.get(gameId);
      if (!game) throw new Error("Game not found");
      const chatMsg = {
        senderName,
        message,
        time: new Date().toLocaleTimeString()
      };
      if (!game.chatMessages) {
        game.chatMessages = [];
      }
      game.chatMessages.push(chatMsg);
      if (game.chatMessages.length > 10) {
        game.chatMessages.shift();
      }
      io.to(gameId).emit('chatMessage', chatMsg);
      console.log(`Chat in ${gameId} from ${senderName}: ${message}`);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // (Optional) Remove player logic if desired.
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
