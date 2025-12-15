import type { CardData } from '../types';
import { MiniCard } from './MiniCard';

interface SetSelectionModalProps {
    title: string;
    combos: CardData[][];
    onSelect: (combo: CardData[]) => void;
    onClose: () => void;
    enableSelection?: boolean; // Global enable
    isComboValid?: (combo: CardData[]) => boolean; // Individual item valid?
}

export function SetSelectionModal({ title, combos, onSelect, onClose, enableSelection = true, isComboValid }: SetSelectionModalProps) {
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 3000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '20px',
                maxHeight: '80vh',
                width: '100%',
                maxWidth: '600px',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                        <h3 style={{ margin: 0, color: '#333' }}>Select {title}</h3>
                        {!enableSelection && <div style={{ fontSize: '0.8rem', color: '#f44336' }}>Cannot play this suit right now</div>}
                    </div>
                    <button onClick={onClose} style={{ padding: '8px 16px', background: '#eee', color: '#333' }}>Close</button>
                </div>

                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {combos.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>No valid {title}s found.</div>
                    ) : (
                        combos.map((combo, idx) => {
                            const isValid = enableSelection && (!isComboValid || isComboValid(combo));
                            return (
                                <div 
                                    key={idx}
                                    style={{ 
                                        padding: '15px 10px',
                                        borderRadius: '8px',
                                        cursor: isValid && enableSelection ? 'pointer' : 'default',
                                        display: 'flex',
                                        gap: '5px', // Reduced gap for mini cards
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        backgroundColor: isValid ? '#f9f9f9' : '#eee',
                                        opacity: isValid ? 1 : 0.6,
                                        transition: 'background-color 0.2s',
                                        overflow: 'hidden',
                                        height: '45px',
                                    }}
                                    onMouseEnter={(e) => { if(isValid) e.currentTarget.style.backgroundColor = '#eef'; }}
                                    onMouseLeave={(e) => { if(isValid) e.currentTarget.style.backgroundColor = '#f9f9f9'; }}
                                    onClick={() => { if (isValid && enableSelection) onSelect(combo); }}
                                >
                                    {combo.map((card, i) => (
                                        <MiniCard key={i} card={card} />
                                    ))}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
