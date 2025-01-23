import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function GameConfig() {
  const [config, setConfig] = useState({
    rounds: 2,
    categoriesPerRound: 3,
    questionsPerCategory: 4
  });
  const navigate = useNavigate();

  const createGame = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      const { gameId } = await response.json();
      navigate(`/host/${gameId}`);
    } catch (error) {
      console.error('Game creation failed:', error);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Game Setup</h1>
      
      <div className="space-y-6">
        <NumberInput
          label="Number of Rounds"
          value={config.rounds}
          onChange={v => setConfig(c => ({ ...c, rounds: v }))}
          min={1} max={3}
        />
        
        <NumberInput
          label="Categories per Round"
          value={config.categoriesPerRound}
          onChange={v => setConfig(c => ({ ...c, categoriesPerRound: v }))}
          min={2} max={5}
        />
        
        <NumberInput
          label="Questions per Category"
          value={config.questionsPerCategory}
          onChange={v => setConfig(c => ({ ...c, questionsPerCategory: v }))}
          min={2} max={6}
        />
        
        <button 
          onClick={createGame}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition"
        >
          Create Game
        </button>
      </div>
    </div>
  );
}

function NumberInput({ label, value, onChange, min, max }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Math.min(max, Math.max(min, e.target.value)))}
        className="w-full p-2 border rounded-md"
        min={min}
        max={max}
      />
    </div>
  );
}