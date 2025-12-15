import { useState } from 'react';
import { Card } from './Card';
import type { CardData } from '../types';

interface TableProps {
  cards: CardData[];
  activeComboType?: string | null;
  roundStartIndex?: number;
  playHistory?: Array<{ player: string, cardCount: number }>;
}

export function Table({ cards, activeComboType, roundStartIndex = 0, playHistory = [] }: TableProps) {
  const [expanded, setExpanded] = useState(false);

  // Split Logic: Divide cards into "Previous Rounds" and "Current Round"
  // Safe slice: if roundStartIndex is out of bounds, slice handles it gracefully.
  const validStartIndex = Math.max(0, Math.min(roundStartIndex, cards.length));
  const pastCards = cards.slice(0, validStartIndex);
  const currentCards = cards.slice(validStartIndex);

  const isComboRound = activeComboType === 'straight' || activeComboType === 'triplet' || activeComboType === 'quads';

  // Chunk ONLY current cards if it is a combo round
  const chunkedCurrent: CardData[][] = [];
  if (isComboRound) {
      for (let i = 0; i < currentCards.length; i += 5) {
          chunkedCurrent.push(currentCards.slice(i, i + 5));
      }
  }

  // --- Render Empty State ---
  if (cards.length === 0) {
    return (
      <div style={{
        width: '100px',
        height: '140px',
        border: '2px dashed #ccc',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#aaa',
        margin: '0 auto'
      }}>
        Empty Table
      </div>
    );
  }

  const topCard = cards[cards.length - 1];

  return (
    <>
      <div style={{ position: 'relative', height: '160px' }}>
        {/* Main Table View (Always shows top card of pile) */}
        <div onClick={() => setExpanded(true)} style={{ cursor: 'pointer' }}>
             <Card card={topCard} index={0} total={1} />
             {cards.length > 1 && (
                 <div style={{ 
                     position: 'absolute', 
                     top: '5px', left: '5px', 
                     zIndex: -1, 
                     width: '100px', height: '140px', 
                     backgroundColor: '#eee', 
                     border: '1px solid #ddd', 
                     borderRadius: '8px' 
                 }} />
             )}
             <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#666' }}>
               Click to see history ({cards.length})
             </div>
        </div>
      </div>

      {/* History Overlay */}
      {expanded && (
          <div style={{ 
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(255,255,255,0.95)',
              zIndex: 2000,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '20px',
              overflowY: 'auto'
          }} onClick={() => setExpanded(false)}>
              
              <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: '600px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3>Table History ({cards.length})</h3>
                    <button onClick={() => setExpanded(false)} style={{ width: 'auto', padding: '8px 16px' }}>Close</button>
                </div>
                
                {/* Past Cards (Graveyard) */}
                {pastCards.length > 0 && (
                    <div style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                        <h4 style={{ color: '#aaa', margin: '0 0 10px 0', fontSize: '1rem' }}>Previous Rounds ({pastCards.length})</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', opacity: 0.6 }}>
                            {pastCards.map((c, i) => (
                                <div key={i} style={{ transform: 'scale(0.7)' }}>
                                    <Card card={c} index={0} total={1} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>Current Round ({currentCards.length})</h4>
                
                {isComboRound && currentCards.length > 0 ? (
                    // Grouped View for Combos
                    <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '15px' }}>
                        {chunkedCurrent.map((group, gIdx) => {
                            // Calculate which play this is (from current round history)
                            const currentRoundHistory = playHistory.slice(-(chunkedCurrent.length));
                            const playInfo = currentRoundHistory[gIdx];
                            const playerName = playInfo?.player || 'Unknown';
                            
                            return (
                                <div key={gIdx} style={{ 
                                    padding: '10px', 
                                    backgroundColor: gIdx % 2 === 0 ? '#f0f8ff' : '#fff0f0', // Alternating Blue/Red tint
                                    borderRadius: '8px',
                                    border: '1px solid #ddd',
                                    display: 'flex', alignItems: 'center', gap: '10px'
                                }}>
                                    <div style={{ fontWeight: 'bold', minWidth: '80px', color: '#666', fontSize: '0.9rem' }}>
                                        {playerName}
                                    </div>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        {group.map((card, idx) => (
                                            <div key={idx} style={{ transform: 'scale(0.8)', margin: '-10px' }}>
                                                <Card card={card} index={idx} total={group.length} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    // Default View for Singles (or empty)
                    <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '10px', 
                        justifyContent: 'center'
                    }}>
                        {[...currentCards].reverse().map((c, i) => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ transform: 'scale(0.9)' }}>
                                    <Card card={c} index={0} total={1} />
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#666' }}>#{currentCards.length - i}</div>
                            </div>
                        ))}
                    </div>
                )}
              </div>
          </div>
      )}
    </>
  );
}
