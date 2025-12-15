import type { Player } from '../types';

interface OpponentProps {
  player: Player;
  isTurn: boolean;
  position: 'left' | 'right' | 'top'; 
}

export function Opponent({ player, isTurn }: OpponentProps) {
  // Styles based on position (e.g. for a round table layout)
  // For mobile landscape, maybe Left and Right sides?
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '10px',
      border: isTurn ? '2px solid #4facf7' : '2px solid transparent',
      borderRadius: '8px',
      backgroundColor: isTurn ? 'rgba(79, 172, 247, 0.1)' : 'transparent',
      transition: 'all 0.3s'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        backgroundColor: '#ddd',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        marginBottom: '5px'
      }}>
        {player.username.substring(0, 1).toUpperCase()}
      </div>
      <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{player.username}</div>
      <div style={{ fontSize: '0.8rem', color: '#666' }}>
        {player.cardCount} cards
      </div>
    </div>
  );
}
