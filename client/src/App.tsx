import { useState } from 'react';
import { Login } from './components/Login';
import { Game } from './components/Game';
import './index.css';

function App() {
  const [user, setUser] = useState<string | null>(() => {
    return sessionStorage.getItem('naga_poker_username');
  });
  const [demoMode, setDemoMode] = useState(false);

  const handleLogin = (username: string) => {
    sessionStorage.setItem('naga_poker_username', username);
    setUser(username);
    setDemoMode(false);
  };

  const handleDemoMode = (username: string) => {
    setUser(username);
    setDemoMode(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('naga_poker_username');
    setUser(null);
    setDemoMode(false);
  };

  return (
    <div className="app-container">
      {!user ? (
        <Login onLogin={handleLogin} onDemoMode={handleDemoMode} />
      ) : (
        <Game username={user} onLogout={handleLogout} demoMode={demoMode} />
      )}
    </div>
  );
}

export default App;
