import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function GameConfig() {
  const [config, setConfig] = useState({
    rounds: 2,
    categoriesPerRound: 3,
    questionsPerCategory: 4,
    selectedCategories: []
  });
  const [potentialCategories, setPotentialCategories] = useState([]);
  const navigate = useNavigate();

  // Fetch potential categories from the backend (or mock data)
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Replace this with your actual API endpoint if needed
        const mockCategories = [
          { name: "Anagrammed Countries", description: "Unscramble these country names!" },
          { name: "Ridiculous Animal Facts", description: "Weird but true!" },
          { name: "90s Cartoon Theme Songs", description: "Name that tune!" },
          { name: "National Dishes of Asian Countries", description: "Guess the dish!" }
        ];
        setPotentialCategories(mockCategories);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };
    fetchCategories();
  }, []);

  // Handle changes to the configuration inputs
  const handleInputChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  // Handle category selection
  const toggleCategorySelection = (categoryName) => {
    setConfig(prev => {
      const isSelected = prev.selectedCategories.includes(categoryName);
      return {
        ...prev,
        selectedCategories: isSelected
          ? prev.selectedCategories.filter(cat => cat !== categoryName)
          : [...prev.selectedCategories, categoryName]
      };
    });
  };

  // Create a new game
  const createGame = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error('Failed to create game');
      }

      const { gameId } = await response.json();
      navigate(`/host/${gameId}`);
    } catch (error) {
      console.error('Game creation failed:', error);
      alert('Failed to create game. Please try again.');
    }
  };

  return (
    <div>
      <h1>Game Setup</h1>

      {/* Rounds Input */}
      <label>
        Number of Rounds:
        <input
          type="number"
          value={config.rounds}
          onChange={(e) => handleInputChange('rounds', Math.max(1, Math.min(3, e.target.value)))}
          min={1}
          max={3}
        />
      </label>

      {/* Categories Per Round Input */}
      <label>
        Categories per Round:
        <input
          type="number"
          value={config.categoriesPerRound}
          onChange={(e) => handleInputChange('categoriesPerRound', Math.max(2, Math.min(5, e.target.value)))}
          min={2}
          max={5}
        />
      </label>

      {/* Questions Per Category Input */}
      <label>
        Questions per Category:
        <input
          type="number"
          value={config.questionsPerCategory}
          onChange={(e) => handleInputChange('questionsPerCategory', Math.max(2, Math.min(6, e.target.value)))}
          min={2}
          max={6}
        />
      </label>

      {/* Category Selection */}
      <h2>Select Categories</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {potentialCategories.map((category, index) => (
          <button
            key={index}
            onClick={() => toggleCategorySelection(category.name)}
            style={{
              backgroundColor: config.selectedCategories.includes(category.name) ? '#4CAF50' : '#f1f1f1',
              color: config.selectedCategories.includes(category.name) ? 'white' : 'black',
              padding: '10px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Create Game Button */}
      <button onClick={createGame} disabled={config.selectedCategories.length === 0}>
        Create Game
      </button>
    </div>
  );
}