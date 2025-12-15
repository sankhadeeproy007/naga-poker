import { Card } from './Card';
import type { CardData } from '../types';
import { getCardValue } from '../utils/comboUtils';

interface HandProps {
  cards: CardData[];
  isMyTurn: boolean;
  tableTopValue: number; // 0 if empty
  onPlayCard: (index: number) => void;
  disabled?: boolean;
  sortOrder: 'ltr' | 'rtl';
}

export function Hand({ cards, isMyTurn, tableTopValue, onPlayCard, sortOrder, disabled = false }: HandProps) {
  // Map to preserve original index, then sort
  const cardsWithIndex = cards.map((c, i) => ({ ...c, originalIndex: i }));
  
  const sortedCards = [...cardsWithIndex].sort((a, b) => {
    const valA = getCardValue(a);
    const valB = getCardValue(b);
    
    return sortOrder === 'ltr' 
      ? valA - valB 
      : valB - valA;
  });

  // Handler for card clicks - simply pass to parent
  const handleCardClick = (cardData: CardData & { originalIndex: number }) => {
     if (disabled) {
         console.log('[DEBUG-HAND] Disabled prop is true');
         return; 
     }

     const val = getCardValue(cardData);
     const playable = tableTopValue === 0 ? true : val > tableTopValue;
     
     console.log('[DEBUG-HAND]', { 
         card: `${cardData.rank}${cardData.suit}`, 
         val, 
         tableTopValue, 
         playable,
         isMyTurn 
     });

     if (isMyTurn && playable) {
         onPlayCard(cardData.originalIndex);
     }
  };

  return (
    <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
      <div className="hand-container">
        {sortedCards.map((c, i) => {
          
          return (
             <div 
               key={`${c.rank}-${c.suit}`} 
               onClick={() => handleCardClick(c)} 
             >
                <Card card={c} index={i} total={sortedCards.length} />
             </div>
          );
        })}
      </div>
    </div>
  );
}
