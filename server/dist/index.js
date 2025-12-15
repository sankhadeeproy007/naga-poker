"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/', (req, res) => {
    res.send('Naga Poker Server is running');
});
app.post('/api/login', (req, res) => {
    const { password, username } = req.body;
    if (password === 'naga-poker' && username) {
        res.json({ success: true, username });
    }
    else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});
const gameUtils_1 = require("./gameUtils");
let players = [];
// Game State
let gameActive = false;
let playerHands = {}; // Map username -> Hand
let turnIndex = 0; // Index in players array
let tableCards = []; // Stack of played cards
// Game Management
let restartVotes = new Set(); // Stores usernames that voted YES
let restartRequester = '';
let lastPlayerToPlay = ''; // Username of the last player to play a card
let roundStartIndex = 0; // Index in tableCards where the current logical round starts
let activeComboType = null;
let activeComboValue = 0;
const comboUtils_1 = require("./comboUtils");
io.on('connection', (socket) => {
    console.log('a user connected', socket.id);
    socket.on('join_game', (username) => {
        // If game is active, check if this is a reconnecting player
        if (gameActive) {
            if (playerHands[username]) {
                // Reconnect successful
                console.log(`Player ${username} reconnected.`);
                socket.emit('game_started', {
                    hand: playerHands[username],
                    turnIndex,
                    tableCards,
                    roundStartIndex,
                    players: players.map(p => ({ username: p.username, cardCount: playerHands[p.username].length }))
                });
                const pIndex = players.findIndex(p => p.username === username);
                if (pIndex !== -1) {
                    players[pIndex].id = socket.id;
                }
                else {
                    players.push({ id: socket.id, username });
                }
            }
            else {
                socket.emit('game_full');
            }
            return;
        }
        // Basic preventing duplicates for dev simplicity or reconnects
        const existing = players.find(p => p.username === username);
        if (existing) {
            existing.id = socket.id;
            io.emit('player_update', players);
            return;
        }
        // Check if max lobby size
        if (players.length < 3) {
            players.push({ id: socket.id, username });
            io.emit('player_update', players);
            if (players.length === 3) {
                // START GAME
                console.log('3 Players joined. Starting game...');
                const deck = (0, gameUtils_1.shuffleDeck)((0, gameUtils_1.generateDeck)());
                const [h1, h2, h3] = (0, gameUtils_1.dealCards)(deck);
                gameActive = true;
                playerHands[players[0].username] = h1;
                playerHands[players[1].username] = h2;
                playerHands[players[2].username] = h3;
                playerHands[players[2].username] = h3;
                tableCards = [];
                roundStartIndex = 0;
                activeComboType = null;
                activeComboValue = 0;
                // Find who has 3 of Clubs
                // 3 of Clubs value is 12 (Rank 3 index 0 * 10 + Suit Clubs 2) -> Wait, logic check:
                // Rank 3 => 1. Suit Clubs => 2. Total 12.
                const threeClubsVal = 1 * 10 + 2;
                // Check each hand
                const p1Has = h1.some(c => c.rank === '3' && c.suit === 'clubs');
                const p2Has = h2.some(c => c.rank === '3' && c.suit === 'clubs');
                const p3Has = h3.some(c => c.rank === '3' && c.suit === 'clubs');
                if (p1Has)
                    turnIndex = 0;
                else if (p2Has)
                    turnIndex = 1;
                else
                    turnIndex = 2;
                // Emit to each
                players.forEach((p, idx) => {
                    io.to(p.id).emit('game_started', {
                        hand: playerHands[p.username],
                        turnIndex,
                        tableCards: [],
                        roundStartIndex: 0,
                        players: players.map(pl => ({ username: pl.username, cardCount: playerHands[pl.username].length }))
                    });
                });
            }
        }
        else {
            socket.emit('game_full');
        }
    });
    socket.on('play_turn', (indices) => {
        // Identify player
        const pIndex = players.findIndex(p => p.id === socket.id);
        if (pIndex === -1)
            return; // Not found
        // Check turn
        if (pIndex !== turnIndex) {
            console.log(`Not player ${pIndex}'s turn`);
            return;
        }
        const username = players[pIndex].username;
        const hand = playerHands[username];
        // Validate Indices
        if (!hand || indices.some(i => i < 0 || i >= hand.length))
            return;
        // Get Cards
        const cardsToPlay = indices.map(i => hand[i]);
        // Identify Combo
        const combo = (0, comboUtils_1.identifyCombo)(cardsToPlay); // { type, value }
        if (!combo) {
            console.log("Invalid combination played");
            return;
        }
        // Validation against Active Table
        const activeTableCards = tableCards.slice(roundStartIndex);
        if (activeTableCards.length === 0) {
            // New Round (or Start of Game)
            // Must play 3 of Clubs check (First turn of game)
            if (tableCards.length === 0 && roundStartIndex === 0) {
                // Enforce 3 of Clubs presence?
                // "Start with 3 of Clubs". Usually implies 3 of Clubs MUST be in the set.
                const has3Clubs = cardsToPlay.some(c => c.rank === '3' && c.suit === 'clubs');
                if (!has3Clubs) {
                    console.log("Must play 3 of Clubs in the first hand");
                    return;
                }
            }
            // Allowed. Set Active State.
            // Note: Logic allows setting the Type (Single or Set).
        }
        else {
            // Verify Hierarchy
            if (cardsToPlay.length !== activeTableCards.length) {
                // Usually count must match (1 vs 1, 5 vs 5).
                // Exception: If we support Quads vs Triplet? No, always 5 cards.
                // So if table has 1, you played 5? Reject.
                // If table has 5, you played 1? Reject.
                if (activeTableCards.length === 1 && cardsToPlay.length !== 1) {
                    console.log("Must play Single");
                    return;
                }
                if (activeTableCards.length === 5 && cardsToPlay.length !== 5) {
                    console.log("Must play 5 Cards");
                    return;
                }
            }
            // Verify Value Logic
            if (combo.type === 'single') {
                // Standard single check
                if (combo.value <= activeComboValue) {
                    console.log("Single too small");
                    return;
                }
            }
            else {
                // Set Logic
                // Hierarchy: Straight(1) < Triplet(2) < Quads(3).
                const typeRank = { 'straight': 1, 'triplet': 2, 'quads': 3 };
                const currentRank = typeRank[activeComboType] || 0;
                const playedRank = typeRank[combo.type] || 0;
                if (playedRank < currentRank) {
                    console.log("Combo Type too weak");
                    return;
                }
                if (playedRank === currentRank) {
                    // Compare Values
                    if (combo.value <= activeComboValue) {
                        console.log("Combo Value too small");
                        return;
                    }
                }
                // If playedRank > currentRank, Allowed (e.g. Quads on FullHouse).
            }
        }
        // Execute Move
        // Remove from hand (Indices must be handled carefully as splicing shifts indices!)
        // Sort indices Descending to splice safely
        const sortedIndices = [...indices].sort((a, b) => b - a);
        for (const idx of sortedIndices) {
            playerHands[username].splice(idx, 1);
        }
        // Add to table
        tableCards.push(...cardsToPlay);
        // Update State
        activeComboType = combo.type;
        activeComboValue = combo.value;
        // Update Turn (Anti-clockwise)
        turnIndex = (turnIndex - 1 + 3) % 3;
        lastPlayerToPlay = username;
        // Broadcast update
        const actionText = combo.type === 'single'
            ? `${username} played ${cardsToPlay[0].rank} of ${cardsToPlay[0].suit}`
            : `${username} played ${combo.type}`;
        io.emit('game_update', {
            turnIndex,
            tableCards,
            roundStartIndex,
            players: players.map(p => ({ username: p.username, cardCount: playerHands[p.username].length })),
            lastAction: actionText
        });
        // Also update the player's own hand privately
        socket.emit('hand_update', playerHands[username]);
    });
    socket.on('pass_turn', () => {
        // Identify player
        const pIndex = players.findIndex(p => p.id === socket.id);
        if (pIndex === -1)
            return;
        if (pIndex !== turnIndex) {
            console.log(`Not player ${pIndex}'s turn to pass`);
            return;
        }
        const username = players[pIndex].username;
        // Calculate Next Turn (Anti-clockwise)
        const nextTurnIndex = (turnIndex - 1 + 3) % 3;
        const nextPlayer = players[nextTurnIndex].username;
        turnIndex = nextTurnIndex;
        let actionMessage = `${username} passed`;
        // Check if Round Won (Next player is the last one who played)
        if (nextPlayer === lastPlayerToPlay) {
            console.log(`Round won by ${nextPlayer}. Soft Reset.`);
            // Soft Reset: New round starts after the current pile.
            roundStartIndex = tableCards.length;
            activeComboType = null;
            activeComboValue = 0;
            // tableCards remain!
            actionMessage = `${username} passed. Round won by ${nextPlayer}!`;
        }
        io.emit('game_update', {
            turnIndex,
            tableCards,
            roundStartIndex,
            players: players.map(p => ({ username: p.username, cardCount: playerHands[p.username].length })),
            lastAction: actionMessage
        });
    });
    socket.on('request_restart', () => {
        if (!gameActive)
            return;
        const p = players.find(p => p.id === socket.id);
        if (!p)
            return;
        console.log(`${p.username} requested restart`);
        restartRequester = p.username;
        restartVotes.clear();
        restartVotes.add(p.username); // Requester implicitly votes yes
        // Broadcast to all
        io.emit('restart_requested', { requester: p.username });
        io.emit('restart_vote_update', { count: restartVotes.size });
    });
    socket.on('vote_restart', (vote) => {
        if (!gameActive)
            return;
        const p = players.find(p => p.id === socket.id);
        if (!p)
            return;
        if (vote) {
            restartVotes.add(p.username);
            console.log(`${p.username} voted YES. Total: ${restartVotes.size}`);
            io.emit('restart_vote_update', { count: restartVotes.size });
            if (restartVotes.size === 3) {
                // ALL YES -> RESTART
                console.log('Restarting Game...');
                // Reset State (Similar to Start Game)
                const deck = (0, gameUtils_1.shuffleDeck)((0, gameUtils_1.generateDeck)());
                const [h1, h2, h3] = (0, gameUtils_1.dealCards)(deck);
                playerHands[players[0].username] = h1;
                playerHands[players[1].username] = h2;
                playerHands[players[2].username] = h3;
                playerHands[players[2].username] = h3;
                playerHands[players[2].username] = h3;
                tableCards = [];
                roundStartIndex = 0;
                activeComboType = null;
                activeComboValue = 0;
                // Find Turn Index (Who has 3 of Clubs)
                const p1Has = h1.some(c => c.rank === '3' && c.suit === 'clubs');
                const p2Has = h2.some(c => c.rank === '3' && c.suit === 'clubs');
                const p3Has = h3.some(c => c.rank === '3' && c.suit === 'clubs');
                if (p1Has)
                    turnIndex = 0;
                else if (p2Has)
                    turnIndex = 1;
                else
                    turnIndex = 2;
                // Broadcast Start
                players.forEach((player) => {
                    io.to(player.id).emit('game_started', {
                        hand: playerHands[player.username],
                        turnIndex,
                        tableCards: [],
                        roundStartIndex: 0,
                        players: players.map(pl => ({ username: pl.username, cardCount: playerHands[pl.username].length }))
                    });
                });
                restartVotes.clear();
                restartRequester = '';
            }
        }
        else {
            // Voted NO -> Cancel Restart
            console.log(`${p.username} voted NO. Restart cancelled.`);
            io.emit('restart_cancelled');
            restartVotes.clear();
            restartRequester = '';
        }
    });
    socket.on('disconnect', () => {
        console.log('user disconnected', socket.id);
        // Only remove if game NOT active? 
        // If game is active, we sort of want to keep their spot "reserved" by username.
        // If we remove them, players.length drops to 2.
        // However, if we don't remove, the list stays 3. 
        // If user reloads, disconnect fires -> connect fires.
        // Standard approach: Remove from socket list, but keep game state.
        if (!gameActive) {
            players = players.filter(p => p.id !== socket.id);
            io.emit('player_update', players);
        }
        else {
            // Game active. If they disconnect, we might just mark them offline visually, 
            // but for this MVP, just strictly keeping the data is enough.
            // We DON'T remove from players list so that we don't trigger "Waiting 2/3".
            // BUT if they rejoin, we need to update the id (handled in join_game).
            // If we don't remove, `player_update` isn't emitted, so others don't see them leave. Good.
        }
    });
});
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
