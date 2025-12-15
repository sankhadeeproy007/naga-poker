import type { CardData } from '../types';

const SUIT_ICONS: Record<string, string> = {
  diamonds: '♦',
  clubs: '♣',
  hearts: '♥',
  spades: '♠'
};

const SUIT_COLORS: Record<string, string> = {
  diamonds: '#d93025',
  clubs: '#1a1a1a',
  hearts: '#d93025',
  spades: '#1a1a1a'
};

interface CardProps {
  card: CardData;
  index: number;
  total: number;
}

export function Card({ card, index: _index, total: _total }: CardProps) {
  // Simple layout logic to fan cards or overlap them
  // For MVP, just a horizontal overlap
  return (
    <div style={{
      width: '50px',
      height: '120px',
      backgroundColor: '#ffffff',
      border: '1px solid #ccc',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '10px',
      position: 'relative',
      marginRight: '-35px', // Overlap
      boxShadow: '-2px 0 5px rgba(0,0,0,0.5)',
      color: SUIT_COLORS[card.suit],
      userSelect: 'none',
      cursor: 'pointer',
      transform: 'translateY(0)',
      transition: 'transform 0.2s',
      fontSize: '20px'
    }}
    className="playing-card"
    >
      <div style={{ textAlign: 'left', fontWeight: 'bold' }}>
        {card.rank}<br/>{SUIT_ICONS[card.suit]}
      </div>
      <div style={{ textAlign: 'center', fontSize: '30px', position: 'absolute', top: '50%', left: '60%', transform: 'translate(-50%, -50%)' }}>
        {SUIT_ICONS[card.suit]}
      </div>
      <div style={{ textAlign: 'right', fontWeight: 'bold', transform: 'rotate(180deg)' }}>
        {card.rank}<br/>{SUIT_ICONS[card.suit]}
      </div>
    </div>
  );
}
