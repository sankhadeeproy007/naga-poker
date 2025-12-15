import type { CardData } from '../types';

const SUIT_SYMBOLS: Record<string, string> = {
  diamonds: '♦',
  clubs: '♣',
  hearts: '♥',
  spades: '♠'
};

const SUIT_COLORS: Record<string, string> = {
  diamonds: '#e74c3c',
  clubs: '#2c3e50',
  hearts: '#e74c3c',
  spades: '#2c3e50'
};

interface MiniCardProps {
  card: CardData;
}

export function MiniCard({ card }: MiniCardProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '40px',
        height: '55px',
        backgroundColor: 'white',
        border: '2px solid #ddd',
        borderRadius: '6px',
        fontSize: '1.1rem',
        fontWeight: 'bold',
        color: SUIT_COLORS[card.suit],
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        userSelect: 'none',
        padding: '2px'
      }}
    >
      <div style={{ fontSize: '0.95rem', lineHeight: '1' }}>{card.rank}</div>
      <div style={{ fontSize: '1.2rem', lineHeight: '1' }}>{SUIT_SYMBOLS[card.suit]}</div>
    </div>
  );
}
