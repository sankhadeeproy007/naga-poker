import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { SetSelectionModal } from './SetSelectionModal';
import { findStraights, findFullHouses, findQuads, getComboValue, getCardValue } from '../utils/comboUtils';
import { dealDemoHand } from '../utils/demoUtils';
import { Hand } from './Hand';
import { Table } from './Table';
import { Opponent } from './Opponent';
import { OrientationWarning } from './OrientationWarning';
import type { CardData, Player, GameStartPayload } from '../types';

interface GameProps {
  username: string;
  onLogout: () => void;
  demoMode?: boolean;
}

  // Helper to get card value
  // Using Centralized Logic
  const getVal = getCardValue;

export function Game({ username, onLogout, demoMode = false }: GameProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Game Loop State
  const [players, setPlayers] = useState<Player[]>([]);
  const [myHand, setMyHand] = useState<CardData[]>([]);
  const [tableCards, setTableCards] = useState<CardData[]>([]);
  const [roundStartIndex, setRoundStartIndex] = useState<number>(0);
  const [playHistory, setPlayHistory] = useState<Array<{ player: string, cardCount: number }>>([]);
  const [turnIndex, setTurnIndex] = useState<number>(-1);
  const [activeComboType, setActiveComboType] = useState<'single' | 'straight' | 'triplet' | 'quads' | null>(null);
  const [activeComboValue, setActiveComboValue] = useState<number>(0);
  const [undoCounts, setUndoCounts] = useState<Record<string, number>>({});
  const [gameFull, setGameFull] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');

  // Game Management State
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [restartStatus, setRestartStatus] = useState<'none' | 'voting'>('none');
  const [restartRequester, setRestartRequester] = useState('');
  const [hasVoted, setHasVoted] = useState(false);
  const [voteCount, setVoteCount] = useState(0);

  const [showSettings, setShowSettings] = useState(false);
  const [sortOrder, setSortOrder] = useState<'ltr' | 'rtl'>('ltr');
  const [autoPassEnabled, setAutoPassEnabled] = useState(true);
  const [autoPassSeconds, setAutoPassSeconds] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [winner, setWinner] = useState<string | null>(null);
  const [winnerVote, setWinnerVote] = useState<boolean | null>(null);
  const [turnLocked, setTurnLocked] = useState(false);
  
  // Set/Combo State
  const [avStraights, setAvStraights] = useState<CardData[][]>([]);
  const [avFullHouses, setAvFullHouses] = useState<CardData[][]>([]);
  const [avQuads, setAvQuads] = useState<CardData[][]>([]);
  
  const [comboModalOpen, setComboModalOpen] = useState(false);
  const [comboModalType, setComboModalType] = useState<'Straight' | 'Triplet' | '4 Cards'>('Straight');
  const [comboModalOptions, setComboModalOptions] = useState<CardData[][]>([]);

  useEffect(() => {
    // Demo Mode: Skip socket connection and deal local hand
    if (demoMode) {
        const demoHand = dealDemoHand();
        setMyHand(demoHand);
        setGameFull(true); // Simulate game ready state
        return; // Skip socket logic
    }

    const BACKEND_URL = import.meta.env.MODE === 'production'
      ? 'https://naga-poker-production.up.railway.app' 
      : 'http://localhost:3000';
    const s = io(BACKEND_URL);
    // Normal multiplayer mode
    setSocket(s);
    // ... logic ...
    s.emit('join_game', username);
    s.on('player_update', setPlayers);
    
    // Game Events
    s.on('game_started', (data: GameStartPayload) => {
       setMyHand(data.hand);
       setTurnIndex(data.turnIndex);
       setTableCards(data.tableCards);
       setRoundStartIndex(data.roundStartIndex || 0);
       setPlayHistory(data.playHistory || []);
       setActiveComboType(data.activeComboType || null);
       // Backend should send activeComboValue for strict validation?
       // I forgot to add activeComboValue to the payload in types.ts and index.ts.
       setActiveComboValue(data.activeComboValue || 0);
       if (data.playerUndoCounts) setUndoCounts(data.playerUndoCounts);
       setPlayers(data.players); 
       setGameFull(true); 
       // Reset management state
       setRestartStatus('none');
       setRestartRequester('');
       setHasVoted(false);
       setVoteCount(0);
       setAutoPassSeconds(null);
    });
    
    s.on('game_full', () => setGameFull(true));
    s.on('game_update', (data: any) => {
        setPlayers(data.players || []);
        setTurnIndex(data.turnIndex);
        setTableCards(data.tableCards);
        if (typeof data.roundStartIndex === 'number') setRoundStartIndex(data.roundStartIndex);
        if (data.playHistory) setPlayHistory(data.playHistory);
        
        // Sync Active State (Critical Fix)
        if (data.activeComboType !== undefined) setActiveComboType(data.activeComboType);
        if (data.activeComboValue !== undefined) setActiveComboValue(data.activeComboValue);
        
        // Lock turn for 3 seconds after each play
        setTurnLocked(true);
        
        if (data.lastAction) {
            console.log(`[Game Update] ${data.lastAction}`);
            setLastAction(data.lastAction);
        }
        if (data.playerUndoCounts) setUndoCounts(data.playerUndoCounts);
    });
    s.on('hand_update', setMyHand);

    // Restart Events
    s.on('restart_requested', (data: { requester: string }) => {
        setRestartRequester(data.requester);
        setRestartStatus('voting');
        setHasVoted(false);
        setVoteCount(1); // Requester counts as 1
    });
    s.on('restart_vote_update', (data: { count: number }) => {
        setVoteCount(data.count);
    });
    s.on('restart_cancelled', () => {
        setRestartStatus('none');
        setRestartRequester('');
        setHasVoted(false);
        setVoteCount(0);
        alert('Restart request was rejected.');
    });

    s.on('undo_update', (counts: Record<string, number>) => {
        setUndoCounts(counts);
    });
    
    s.on('game_won', (data: { winner: string }) => {
        console.log(`Game won by ${data.winner}`);
        setWinner(data.winner);
        setWinnerVote(null);
    });

    s.on('turn_unlocked', () => {
        setTurnLocked(false);
    });

    return () => {
        s.disconnect();
        s.off('game_started');
        s.off('game_update');
        s.off('game_full');
        s.off('hand_update');
        s.off('player_update');
        s.off('restart_requested');
        s.off('restart_vote_update');
        s.off('restart_cancelled');
        s.off('undo_update');
    };
  }, [username]);

  // ... (Calculations) ...
  const myIndex = players.findIndex(p => p.username === username);
  const isMyTurn = myIndex !== -1 && myIndex === turnIndex;
  const opponents = players.filter(p => p.username !== username);
  
  // Soft Reset Logic: Only consider cards from current round
  const activeTableCards = tableCards.slice(roundStartIndex);
  const tableTopVal = activeTableCards.length > 0 ? getVal(activeTableCards[activeTableCards.length - 1]) : 0;
  
  // Set Availability Calculation
  useEffect(() => {
     if (myHand.length >= 5) {
         setAvStraights(findStraights(myHand));
         setAvFullHouses(findFullHouses(myHand));
         setAvQuads(findQuads(myHand));
     } else {
         setAvStraights([]);
         setAvFullHouses([]);
         setAvQuads([]);
     }
  }, [myHand]);

  // Rule: Start of Game (tableCards empty) -> Single Only.
  // Won Round (tableCards not empty, active empty) -> Single or Set.
  // Responding ->  // Determine if player can play combos
  const isLeading = activeTableCards.length === 0;
  const isComboRound = activeComboType === 'straight' || activeComboType === 'triplet' || activeComboType === 'quads';
  const canPlayCombos = isMyTurn && (isLeading || isComboRound);

  const gameStarted = myHand.length > 0;

  // Auto-Pass Effect
  useEffect(() => {
    if (!isMyTurn || !gameStarted) {
        setAutoPassSeconds(null);
        return;
    }

    // Check if any card is playable
    // If tableTopVal == 0 (Empty table or New Round), any card is playable.
    // However, if hand is empty, game should be technically over or waiting, but let's assume valid play check.
    const canPlay = tableTopVal === 0 
        ? myHand.length > 0
        : myHand.some(c => getVal(c) > tableTopVal);

    if (!canPlay) {
        // Start Countdown
        if (autoPassSeconds === null) {
            setAutoPassSeconds(3);
        }
    } else {
        setAutoPassSeconds(null);
    }
  }, [isMyTurn, myHand, tableTopVal, gameStarted, autoPassSeconds, autoPassEnabled]);

  useEffect(() => {
      if (autoPassSeconds !== null && autoPassSeconds > 0) {
          const timer = setInterval(() => {
              setAutoPassSeconds(prev => {
                  if (prev === null) return null;
                  if (prev <= 1) {
                       clearInterval(timer);
                       socket?.emit('pass_turn'); 
                       return null;
                  }
                  return prev - 1;
              });
          }, 1000);
          return () => clearInterval(timer);
      }
  }, [autoPassSeconds, socket]);

  // Sound effect for turn notification
  useEffect(() => {
      if (isMyTurn && soundEnabled && gameFull) {
          // Play bell sound using Web Audio API
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = 800; // Bell-like frequency
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.5);
      }
  }, [isMyTurn, soundEnabled, gameFull]);

  const handlePlayCard = (index: number) => {
      // Convert Single Card Play to Unified Play Turn
      socket?.emit('play_turn', [index]);
  };
  
  const handlePass = () => {
      socket?.emit('pass_turn');
  };

  const handleUndo = () => {
      if (socket) socket.emit('undo_turn');
  };

const handlePlaySet = (cards: CardData[]) => {
    // Send indices
    // We need to find indices of these specific cards in hand.
    // Since cards object refs might differ, match by Rank/Suit.
    const indices = cards.map(c => myHand.findIndex(h => h.rank === c.rank && h.suit === c.suit));
    if (indices.some(i => i === -1)) {
        console.error("Card not found in hand");
        return;
    }
    socket?.emit('play_turn', indices);
    setComboModalOpen(false);
};

const openSetModal = (type: 'Straight' | 'Triplet' | '4 Cards') => {
    setComboModalType(type);
    if (type === 'Straight') setComboModalOptions(avStraights);
    if (type === 'Triplet') setComboModalOptions(avFullHouses);
    if (type === '4 Cards') setComboModalOptions(avQuads);
    setComboModalOpen(true);
};
  
  const handleRequestRestart = () => {
      socket?.emit('request_restart');
      setShowSettings(false); // Close settings
  };

  const handleVoteRestart = (vote: boolean) => {
      if (!socket) return;
      setHasVoted(true);
      socket.emit('vote_restart', vote);
  };
  
  const handleWinnerVote = (vote: boolean) => {
      if (!socket) return;
      setWinnerVote(vote);
      socket.emit('vote_restart', vote);
  };

  const handleReshuffle = () => {
      const newHand = dealDemoHand();
      setMyHand(newHand);
  };

  // Demo Mode Rendering
  if (demoMode) {
      return (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <OrientationWarning />
              
              {/* Demo Banner */}
              <div style={{ backgroundColor: '#2196f3', color: 'white', padding: '15px', textAlign: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: '1.2rem' }}>🎮 DEMO MODE - Explore the Game!</h2>
                  <p style={{ margin: '5px 0 0', fontSize: '0.9rem' }}>Test combos and explore the UI. No actual game in progress.</p>
              </div>

              {/* Exit Demo Button */}
              <div style={{ position: 'absolute', top: '80px', right: '20px', zIndex: 100, display: 'flex', gap: '10px' }}>
                  <button onClick={onLogout} style={{ padding: '8px 16px', backgroundColor: '#ff4444', color: 'white' }}>
                      Exit Demo
                  </button>
              </div>
                    <div style={{ position: 'absolute', top: '80px', left: '20px', zIndex: 100, display: 'flex', gap: '10px' }}>
                  <button 
                      onClick={handleReshuffle} 
                      style={{ padding: '8px 16px', backgroundColor: '#4caf50', color: 'white' }}
                  >
                      🔄 Reshuffle Cards
                  </button>
              </div>

              {/* Main Content */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '20px' }}>
                  {/* Combo Buttons */}
                  <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button 
                          onClick={() => openSetModal('Straight')} 
                          disabled={avStraights.length === 0}
                          style={{ padding: '10px 20px', fontSize: '0.9rem' }}
                      >
                          Straight ({avStraights.length})
                      </button>
                      <button 
                          onClick={() => openSetModal('Triplet')} 
                          disabled={avFullHouses.length === 0}
                          style={{ padding: '10px 20px', fontSize: '0.9rem' }}
                      >
                          Triplet ({avFullHouses.length})
                      </button>
                      <button 
                          onClick={() => openSetModal('4 Cards')} 
                          disabled={avQuads.length === 0}
                          style={{ padding: '10px 20px', fontSize: '0.9rem' }}
                      >
                          4 Cards ({avQuads.length})
                      </button>
                      <button 
                          onClick={() => setSortOrder(prev => prev === 'ltr' ? 'rtl' : 'ltr')}
                          style={{ padding: '10px 20px', fontSize: '0.9rem', backgroundColor: '#666', color: 'white' }}
                      >
                          Sort: {sortOrder.toUpperCase()}
                      </button>
                  </div>

                  {/* Hand */}
                  <Hand 
                      cards={myHand} 
                      isMyTurn={false} 
                      tableTopValue={0} 
                      onPlayCard={() => {}} 
                      sortOrder={sortOrder}
                      disabled={true}
                  />
              </div>

              {/* Combo Modal */}
              {comboModalOpen && (
                  <SetSelectionModal
                      title={comboModalType}
                      combos={comboModalOptions}
                      onSelect={() => setComboModalOpen(false)}
                      onClose={() => setComboModalOpen(false)}
                      enableSelection={false}
                      isComboValid={() => false}
                  />
              )}
          </div>
      );
  }

  if (gameFull && !gameStarted && !winner) {
      return (
          <div className="card">
              <OrientationWarning />
              <h1>Table Full / Joining...</h1>
              <button onClick={onLogout} style={{ marginTop: '20px', width: 'auto' }}>Back to Login</button>
          </div>
      );
  }

  if (gameStarted || winner) {
       return (
          <div className="fade-in" style={{  display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <OrientationWarning />
              
              {/* Overlays */}
          {/* Winner Modal */}
          {winner && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', maxWidth: '400px' }}>
                      <h2 style={{ fontSize: '2rem', marginBottom: '20px', color: winner === username ? '#4caf50' : '#2196f3' }}>
                          {winner === username ? '🎉 You Won! 🎉' : `${winner} Won!`}
                      </h2>
                      <p style={{ marginBottom: '30px', fontSize: '1.1rem' }}>Play another game?</p>
                      {winnerVote === null ? (
                          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                              <button onClick={() => handleWinnerVote(true)} style={{ padding: '12px 30px', fontSize: '1rem', backgroundColor: '#4caf50', color: 'white' }}>Yes</button>
                              <button onClick={() => handleWinnerVote(false)} style={{ padding: '12px 30px', fontSize: '1rem', backgroundColor: '#f44336', color: 'white' }}>No</button>
                          </div>
                      ) : (
                          <p style={{ color: '#666' }}>Waiting for other players...</p>
                      )}
                  </div>
              </div>
          )}

          {/* Settings Overlay */}
          {showSettings && (
                 <div style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 4000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <h2>Settings</h2>
                    
                    <button onClick={() => setSortOrder(prev => prev === 'ltr' ? 'rtl' : 'ltr')} style={{ width: '200px', margin: '10px', height: '40px' , display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        Sort: {sortOrder.toUpperCase()}
                    </button>
                    
                    <div style={{ margin: '10px', display: 'flex',  gap: '10px', width: '200px', height: '40px' }}>
                        <input
                            style={{ width: '20px', height: '20px' }}
                            type="checkbox" 
                            checked={soundEnabled} 
                            onChange={(e) => setSoundEnabled(e.target.checked)}
                            id="sound-toggle"
                        />
                        <label htmlFor="sound-toggle">Sound Effects</label>
                    </div>
                    
                    <div style={{ margin: '10px', display: 'flex',  gap: '10px', width: '200px', height: '40px' }}>
                        <input 
                            style={{ width: '20px', height: '20px' }}
                            type="checkbox" 
                            checked={autoPassEnabled} 
                            onChange={(e) => setAutoPassEnabled(e.target.checked)}
                            id="autopass-toggle"
                        />
                        <label htmlFor="autopass-toggle">Auto-Pass (3s)</label>
                    </div>
                    
                    <button onClick={handleRequestRestart} style={{ width: '200px', margin: '10px', height: '40px', backgroundColor: '#ffa000' , display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        Restart Game
                    </button>
                    
                    <button onClick={() => { setShowSettings(false); setShowLeaveConfirm(true); }} style={{ width: '200px', margin: '10px', height: '40px', backgroundColor: '#ff4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        Leave Game
                    </button>
                    
                    <button onClick={() => setShowSettings(false)} style={{ width: '200px', margin: '10px', height: '40px', backgroundColor: '#333', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        Close
                    </button>
                 </div>
              )}

              {showLeaveConfirm && (
                <div style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <h2>Leave Game?</h2>
                    <p>Are you sure you want to quit?</p>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                        <button onClick={onLogout} style={{ backgroundColor: '#ff4444', color: 'white' }}>Yes, Leave</button>
                        <button onClick={() => setShowLeaveConfirm(false)}>Cancel</button>
                    </div>
                </div>
              )}

              {restartStatus === 'voting' && (
                <div style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <h2>Restart Requested</h2>
                    <p>{restartRequester === username ? "Waiting for other players..." : `${restartRequester} wants to restart the game.`}</p>
                    
                    {restartRequester !== username && !hasVoted && (
                         <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                            <button onClick={() => handleVoteRestart(true)} style={{ backgroundColor: '#4caf50' }}>Accept</button>
                            <button onClick={() => handleVoteRestart(false)} style={{ backgroundColor: '#ff4444' }}>Reject</button>
                        </div>
                    )}
                    {(restartRequester === username || hasVoted) && (
                         <div style={{ marginTop: '20px', color: '#aaa' }}>Waiting for votes... ({voteCount}/3)</div>
                    )}
                </div>
              )}

              {/* Top Bar */}
              <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 100 }}>
                  <button onClick={() => setShowSettings(true)} style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}>
                      ⚙️
                  </button>
              </div>

              {/* Main Game Area: Row with Opponents and Table */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', padding: '20px 0' }}>
                  
                 {/* Left Opponent */}
                 <div style={{ width: '120px', display: 'flex', justifyContent: 'center' }}>
                    {opponents[0] && (() => {
                        const p = opponents[0];
                        const pIdx = players.findIndex(pl => pl.username === p.username);
                        return <Opponent key={p.username} player={p} isTurn={pIdx === turnIndex} position="left" />;
                    })()}
                 </div>

                 {/* Center Table */}
                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
                      {lastAction && <div style={{ marginBottom: '10px', fontSize: '0.8rem', color: '#888', whiteSpace: 'nowrap' }}>{lastAction}</div>}
                      <div style={{ marginBottom: '10px', fontWeight: 'bold', color: isMyTurn ? '#4facf7' : '#ccc', fontSize: '0.9rem' }}>
                          {isMyTurn ? "YOUR TURN" : `Turn: ${players[turnIndex]?.username}`}
                      </div>
                      <Table cards={tableCards} activeComboType={activeComboType} roundStartIndex={roundStartIndex} playHistory={playHistory} />
                 </div>

                 {/* Right Opponent */}
                 <div style={{ width: '120px', display: 'flex', justifyContent: 'center' }}>
                    {opponents[1] && (() => {
                        const p = opponents[1];
                        const pIdx = players.findIndex(pl => pl.username === p.username);
                        return <Opponent key={p.username} player={p} isTurn={pIdx === turnIndex} position="right" />;
                    })()}
                 </div>

              </div>
              
              {/* Bottom: Hand + Buttons */}
              <div style={{ position: 'relative' }}>
                <Hand 
                    cards={myHand} 
                    isMyTurn={isMyTurn} 
                    tableTopValue={tableTopVal} 
                    onPlayCard={handlePlayCard}
                    sortOrder={sortOrder}
                    disabled={!isMyTurn || turnLocked}
                />
              </div>

                  {/* Pass Button Area */}
              <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 100, display: 'flex', gap: '10px', flexDirection: 'column', alignItems: 'flex-end' }}>
                  {autoPassSeconds !== null && (
                      <div style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '5px 10px', borderRadius: '4px', marginBottom: '5px', fontSize: '0.8rem' }}>
                          No moves! Passing in {autoPassSeconds}...
                      </div>
                  )}
                  
                  <div style={{ display: 'flex', gap: '10px' }}>
                     {/* Combo Buttons */}
                     {/* Straight */}
                     <button
                        disabled={avStraights.length === 0}
                        onClick={() => openSetModal('Straight')}
                        style={{
                            padding: '12px 16px',
                            backgroundColor: (avStraights.length === 0) ? '#ccc' : '#2196F3',
                            color: 'white', fontWeight: 'bold',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                            opacity: (avStraights.length === 0) ? 0.6 : 1
                        }}
                     >
                        Straight ({avStraights.length})
                     </button>

                     {/* Triplet */}
                     <button
                        disabled={avFullHouses.length === 0}
                        onClick={() => openSetModal('Triplet')}
                        style={{
                            padding: '12px 16px',
                            backgroundColor: (avFullHouses.length === 0) ? '#ccc' : '#9C27B0',
                            color: 'white', fontWeight: 'bold',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                            opacity: (avFullHouses.length === 0) ? 0.6 : 1
                        }}
                     >
                        Triplet ({avFullHouses.length})
                     </button>
                     
                     {/* 4 Cards */}
                     <button
                        disabled={avQuads.length === 0}
                        onClick={() => openSetModal('4 Cards')}
                        style={{
                            padding: '12px 16px',
                            backgroundColor: (avQuads.length === 0) ? '#ccc' : '#E91E63',
                            color: 'white', fontWeight: 'bold',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                            opacity: (avQuads.length === 0) ? 0.6 : 1
                        }}
                     >
                        4 Cards ({avQuads.length})
                     </button>

                     <button 
                        onClick={handlePass} 
                        disabled={!isMyTurn}
                        style={{ 
                            padding: '12px 24px', 
                            width: 'auto', 
                            fontSize: '1rem', 
                            backgroundColor: isMyTurn ? '#ff9800' : '#ccc',
                            color: 'white',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                      >
                        PASS
                      </button>

                     {/* Undo Button */}
                     <button
                        onClick={handleUndo}
                        disabled={!undoCounts[username] || undoCounts[username] <= 0}
                        style={{
                            padding: '12px 16px',
                            backgroundColor: (undoCounts[username] && undoCounts[username] > 0) ? '#ff9800' : '#ccc',
                            color: 'white', fontWeight: 'bold',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                     >
                        Undo ({undoCounts[username] || 0})
                     </button>
                  </div>
              </div>

              {/* Set Selection Modal */}
              {comboModalOpen && (
                  <SetSelectionModal
                      title={comboModalType}
                      combos={comboModalOptions}
                      onSelect={handlePlaySet}
                      onClose={() => setComboModalOpen(false)}
                      enableSelection={canPlayCombos}
                      isComboValid={(combo) => {
                           // Validation Logic
                           console.log('[DEBUG-VALIDATOR]', { 
                              canPlayCombos,
                              isMyTurn,
                              activeTableLen: activeTableCards.length,
                              comboType: comboModalType, 
                              activeType: activeComboType,
                              activeVal: activeComboValue 
                          });

                           if (!canPlayCombos) return false;
                           if (activeTableCards.length === 0) return true; // Leading a trick
                           
                           // Must match Active Type
                          // Map UI Type to Backend Type
                          let modalTypeBackend: 'straight' | 'triplet' | 'quads' | null = null;
                          if (comboModalType === 'Straight') modalTypeBackend = 'straight';
                          if (comboModalType === 'Triplet') modalTypeBackend = 'triplet';
                          if (comboModalType === '4 Cards') modalTypeBackend = 'quads';
                          
                          if (modalTypeBackend !== activeComboType) return false;
                          
                          // Must Beat Active Value
                          // We need Active Combo Value.
                          // If we don't have it from backend explicitly, we can calculate it from activeTableCards?
                          // Yes, `getComboValue(activeTableCards, activeComboType)`.
                          // But activeTableCards is just CardData[].
                          // We should ensure we use the backend's `activeComboValue`.
                          // Since I can't easily update backend/types mid-render without another step,
                          // I will use client calculation on `activeTableCards`.
                          if (!activeComboType) return true; // Should not happen if length=5
                          
                          // Use the active value from backend state (which considers strict rules)
                          const currentVal = activeComboValue;
                          
                          const myVal = getComboValue(combo, comboModalType as any);
                          
                          return myVal > currentVal;
                      }}
                   />
              )}
          </div>
      );
  }

  return (
    <div className="card fade-in" style={{ maxWidth: '800px' }}>
      <OrientationWarning />
      <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
          <button onClick={onLogout} style={{ padding: '8px 16px', width: 'auto', fontSize: '0.8rem' }}>Logout</button>
      </div>
      <h1>Welcome, {username}</h1>
      <p style={{ color: '#888' }}>Waiting for other players... ({players.length}/3)</p>
      
      <div style={{ marginTop: '20px' }}>
          {/* Lobby List */}
          {players.map(p => (
              <div key={p.username} style={{ padding: '5px' }}>{p.username} {p.username === username ? '(You)' : ''}</div>
          ))}
      </div>
    </div>
  );
}
