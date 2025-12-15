import { useState } from 'react';

interface LoginProps {
  onLogin: (username: string) => void;
  onDemoMode: (username: string) => void;
}

const VALID_PLAYERS = ['Roy', 'Lomba', 'Gaal'];

export function Login({ onLogin, onDemoMode }: LoginProps) {
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = playerName.trim();
    if (!trimmedName) {
      setError('Please enter your player name');
      return;
    }

    // Find matching player name (case-insensitive)
    const matchedPlayer = VALID_PLAYERS.find(
      p => p.toLowerCase() === trimmedName.toLowerCase()
    );

    if (!matchedPlayer) {
      setError('Invalid player name. Must be Roy, Lomba, or Gaal.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          password: matchedPlayer.toLowerCase(), 
          username: matchedPlayer 
        }),
      });

      const data = await response.json();

      if (data.success) {
        onLogin(data.username);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Connection error. Is the server running?');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemo = () => {
    onDemoMode('Demo Player');
  };

  return (
    <div className="card fade-in">
      <h1>Naga Poker</h1>
      
      <form onSubmit={handleSubmit}>
        <p style={{ color: '#888', marginBottom: '1.5em' }}>
          Enter your player name
        </p>
        <input
          type="text"
          placeholder="Roy, Lomba, or Gaal"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          autoFocus
        />
        {error && <div style={{ color: '#ff4d4d', marginBottom: '1em' }}>{error}</div>}
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Entering...' : 'Enter Game'}
        </button>
        
        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #ddd' }}>
          <p style={{ color: '#888', marginBottom: '1em', fontSize: '0.9rem' }}>
            Want to try the game first?
          </p>
          <button 
            type="button"
            onClick={handleDemo} 
            style={{ 
              backgroundColor: '#2196f3',
              width: '100%'
            }}
          >
            🎮 Try Demo Mode
          </button>
        </div>
      </form>
    </div>
  );
}
