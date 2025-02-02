export const mockCategories = [
    {
      name: "Anagrammed Countries",
      description: "Unscramble these country names!",
      questions: [
        { question: "A mad gas car", answer: "Madagascar" },
      ]
    },
    {
      name: "Ridiculous Animal Facts",
      description: "Weird but true!",
      questions: [
        { question: "What mammal has the highest blood pressure?", answer: "Giraffe" },
        { question: "What animal's heart is in its head?", answer: "Shrimp" }
      ]
    }
  ];
  
  export const sampleGameState = {
    currentRound: 1,
    currentCategory: 0,
    currentQuestion: 0,
    scores: {
      "player1": 150,
      "player2": 100
    }
  };