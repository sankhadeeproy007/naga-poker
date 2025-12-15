# Naga Poker 🃏

A real-time multiplayer card game for 3 players, built with React, TypeScript, and Socket.IO.

## 🎮 Game Overview

Naga Poker is a strategic card game where players compete to be the first to play all their cards. The game uses a standard 52-card deck and features unique combo mechanics inspired by Big Two (Deuces).

## 🎯 Objective

**Be the first player to play all 13 cards from your hand.**

## 📋 Game Rules

### Setup
- **Players**: Exactly 3 players required
- **Deck**: Standard 52-card deck
- **Cards per player**: 17 cards each
- **Turn order**: Counter-clockwise (anti-clockwise)

### Card Rankings

**Rank Order** (lowest to highest):
```
3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2
```

**Suit Order** (lowest to highest):
```
Diamonds ♦ < Clubs ♣ < Hearts ♥ < Spades ♠
```

**Important**: 2s are the highest rank and have special rules (see below).

### How to Play

#### Starting the Game
1. Three players join the game (Roy, Lomba, or Gaal)
2. Each player receives 17 random cards
3. The player with the lowest card starts
4. Play proceeds counter-clockwise

#### Playing Cards

**Single Cards**
- Play one card at a time
- Must beat the previous card's rank
- If same rank, must beat the suit

**Combos (5-Card Combinations)**
- **Straight**: 5 consecutive ranks (e.g., 3-4-5-6-7)
- **Full House (Triplet)**: 3 of one rank + 2 of another (e.g., 7-7-7-K-K)
- **Four of a Kind (Quads)**: 4 cards of same rank + 1 kicker (e.g., 9-9-9-9-5)


#### Turn Actions

On your turn, you can:
1. **Play Cards**: Play a single card or combo that beats the current table
2. **Pass**: Skip your turn if you can't or don't want to play
3. **Undo**: Take back your last play (limited uses per game)

#### Special Rules

**The 2s Rule**
- 2s are the highest single cards
- **2s CANNOT be used in combos** (straights, full houses, or quads)
- This prevents overpowered combinations

**Round Reset**
- When all players pass consecutively, the round resets
- The last player who played cards starts a new round
- They can play any valid card or combo

**Undo Window**
- After playing cards, there's a 3-second window
- Next player cannot act during this time
- Allows the current player to undo if needed

**Auto-Pass**
- If enabled in settings, automatically passes after 3 seconds of inactivity
- Can be toggled on/off

### Winning

**A player wins when they successfully play all 13 cards.**

After a win:
- All players are prompted to play again
- If all vote "Yes", a new game starts automatically
- If anyone votes "No", players return to lobby

## 🎮 How to Play

### Login
1. Enter your player name: **Roy**, **Lomba**, or **Gaal** (case-insensitive)
2. Wait for 3 players to join
3. Game starts automatically when table is full

### Game Interface

**Your Hand** (bottom)
- Cards are sorted by rank and suit
- Click cards to select them
- Click "Play" to play selected cards
- Click "Pass" to skip your turn

**The Table** (center)
- Shows all played cards
- Current round cards are highlighted
- Click to view full history

**Opponents** (sides)
- Shows card count for each opponent
- Indicates whose turn it is

**Action Buttons**
- **Straight/Triplet/4 Cards**: View and play available combos
- **Undo**: Take back your last play (limited uses)
- **Pass**: Skip your turn
- **Settings** (⚙️): Access game options

### Settings

- **Sort Order**: LTR (Left-to-Right) or RTL (Right-to-Left)
- **Sound Effects**: Toggle turn notification sounds
- **Auto-Pass**: Enable/disable 3-second auto-pass
- **Restart Game**: Vote to restart current game
- **Leave Game**: Exit to login screen

## 🎯 Strategy Tips

1. **Save your 2s**: They're powerful for winning rounds
2. **Watch opponent card counts**: Plan when to play combos
3. **Use undo wisely**: You have limited undos per game
4. **Lead with low cards**: Save high cards for later rounds
5. **Block opponents**: Play strategically to prevent others from winning

## 🎨 Demo Mode

Try the game without joining:
1. Click "🎮 Try Demo Mode" on login screen
2. Get a random 13-card hand
3. Explore combos and UI
4. Click "🔄 Reshuffle Cards" for a new hand
5. No actual gameplay, just exploration

## 🛠️ Technical Details

**Frontend**: React + TypeScript + Vite  
**Backend**: Node.js + Express + Socket.IO  
**Real-time**: WebSocket communication  
**Deployment**: Vercel (frontend) + Railway (backend)

## 📱 Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

**Mobile**: Optimized for mobile browsers with orientation warnings.

## 🎲 Game Variants

This implementation follows the "No 2s in Combos" variant, making the game more balanced and strategic.

---

**Enjoy playing Naga Poker! 🎉**
