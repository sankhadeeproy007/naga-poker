import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// CORS origin validator
const allowedOrigins = [
  "http://localhost:5173",
  "https://naga-poker.vercel.app",
];

const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list or matches Vercel preview pattern
    if (
      allowedOrigins.includes(origin) ||
      origin.match(/https:\/\/naga-poker-.*\.vercel\.app$/)
    ) {
      callback(null, true);
    } else {
      // Still call callback with false instead of throwing error to allow proper CORS response
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"], // Include OPTIONS for preflight requests
  allowedHeaders: ["Content-Type", "Authorization"], // Explicitly allow headers
  exposedHeaders: ["Content-Type"],
};

const io = new Server(httpServer, {
  cors: corsOptions,
});

app.use(cors(corsOptions));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Naga Poker Server is running");
});

app.post("/api/login", (req, res) => {
  const { password, username } = req.body;

  // Valid player names (case-insensitive)
  const validPasswords = ["roy", "lomba", "gaal"];

  if (validPasswords.includes(password?.toLowerCase()) && username) {
    res.json({ success: true, username });
  } else {
    res.status(401).json({ success: false, message: "Invalid player name" });
  }
});

import { generateDeck, shuffleDeck, dealCards, Card } from "./gameUtils";

interface Player {
  id: string;
  username: string;
}

let players: Player[] = [];

// Game State
let gameActive = false;
let playerHands: Record<string, Card[]> = {}; // Map username -> Hand
let turnIndex = 0; // Index in players array
let tableCards: Card[] = []; // Stack of played cards

// Game Management
let restartVotes = new Set<string>(); // Stores usernames that voted YES
let restartRequester = "";
let lastPlayerToPlay = ""; // Username of the last player to play a card
let lastActor = ""; // Username of last person to Act (Play OR Pass)
let roundStartIndex = 0; // Index in tableCards where the current logical round starts
let activeComboType: "single" | "straight" | "triplet" | "quads" | null = null;
let activeComboValue: number = 0;
let playHistory: Array<{ player: string; cardCount: number }> = []; // Track who played each card/combo
let turnLocked = false; // Prevents next player from acting during undo window
let turnLockTimeout: NodeJS.Timeout | null = null; // Timeout for unlocking turn

import { getCardAbsoluteValue } from "./gameUtils";
import { identifyCombo, ComboResult } from "./comboUtils";

// Helper for deep copy
const clone = (obj: any) => JSON.parse(JSON.stringify(obj));

interface GameState {
  tableCards: any[];
  playerHands: Record<string, any[]>;
  turnIndex: number;
  activeComboType: "single" | "straight" | "triplet" | "quads" | null;
  activeComboValue: number;
  roundStartIndex: number;
  lastPlayerToPlay: string;
  lastActor: string;
}

let gameHistory: GameState[] = [];
const MAX_UNDO = 3;
// Map username -> remaining undos
let playerUndoCounts: Record<string, number> = {};

const saveGameState = () => {
  gameHistory.push({
    tableCards: clone(tableCards),
    playerHands: clone(playerHands),
    turnIndex,
    activeComboType,
    activeComboValue,
    roundStartIndex,
    lastPlayerToPlay,
    lastActor,
  });
  // Limit history size? Maybe last 10 moves.
  if (gameHistory.length > 10) gameHistory.shift();
};

io.on("connection", (socket) => {
  console.log("a user connected", socket.id);

  socket.on("join_game", (username: string) => {
    // If game is active, check if this is a reconnecting player
    if (gameActive) {
      if (playerHands[username]) {
        // Reconnect successful
        console.log(`Player ${username} reconnected.`);
        socket.emit("game_started", {
          hand: playerHands[username],
          turnIndex,
          tableCards,
          roundStartIndex,
          playHistory,
          activeComboType, // Restore Active Type
          activeComboValue, // Restore Active Value
          players: players.map((p) => ({
            username: p.username,
            cardCount: playerHands[p.username].length,
          })),
          playerUndoCounts, // Restore Undo Counts
        });

        const pIndex = players.findIndex((p) => p.username === username);
        if (pIndex !== -1) {
          players[pIndex].id = socket.id;
        } else {
          players.push({ id: socket.id, username });
        }
      } else {
        socket.emit("game_full");
      }
      return;
    }

    // Basic preventing duplicates for dev simplicity or reconnects
    const existing = players.find((p) => p.username === username);
    if (existing) {
      existing.id = socket.id;
      io.emit("player_update", players);
      return;
    }

    // Check if max lobby size
    if (players.length < 3) {
      players.push({ id: socket.id, username });
      io.emit("player_update", players);

      if (players.length === 3) {
        // START GAME
        console.log("3 Players joined. Starting game...");
        const deck = shuffleDeck(generateDeck());
        const [h1, h2, h3] = dealCards(deck);

        gameActive = true;
        playerHands[players[0].username] = h1;
        playerHands[players[1].username] = h2;
        playerHands[players[2].username] = h3;
        playerHands[players[2].username] = h3; // This line is duplicated in the original, keeping it as is.
        tableCards = [];
        roundStartIndex = 0;
        activeComboType = null;
        activeComboValue = 0;
        playHistory = []; // Clear play history
        gameHistory = []; // Clear history on new game
        lastPlayerToPlay = ""; // Reset
        lastActor = ""; // Reset

        // Initialize Undo Counts
        players.forEach((p) => {
          playerUndoCounts[p.username] = MAX_UNDO;
        });

        // Find who has 3 of Clubs
        // 3 of Clubs value is 12 (Rank 3 index 0 * 10 + Suit Clubs 2) -> Wait, logic check:
        // Rank 3 => 1. Suit Clubs => 2. Total 12.
        const threeClubsVal = 1 * 10 + 2;

        // Check each hand
        const p1Has = h1.some((c) => c.rank === "3" && c.suit === "clubs");
        const p2Has = h2.some((c) => c.rank === "3" && c.suit === "clubs");
        const p3Has = h3.some((c) => c.rank === "3" && c.suit === "clubs");

        if (p1Has) turnIndex = 0;
        else if (p2Has) turnIndex = 1;
        else turnIndex = 2;

        // Emit to each
        players.forEach((p, idx) => {
          io.to(p.id).emit("game_started", {
            hand: playerHands[p.username],
            turnIndex,
            tableCards: [],
            roundStartIndex: 0,
            playHistory: [],
            players: players.map((pl) => ({
              username: pl.username,
              cardCount: playerHands[pl.username].length,
            })),
            playerUndoCounts, // Send undo counts on game start
          });
        });
      }
    } else {
      socket.emit("game_full");
    }
  });

  socket.on("play_turn", (indices: number[]) => {
    // Identify player
    const pIndex = players.findIndex((p) => p.id === socket.id);
    if (pIndex === -1) {
      console.log(`Play_turn: Player with socket ID ${socket.id} not found.`);
      return; // Not found
    }

    // Check turn
    if (pIndex !== turnIndex) {
      console.log(
        `Play_turn: Not player ${players[pIndex].username}'s turn. Current turn is ${players[turnIndex].username}.`
      );
      return;
    }

    const username = players[pIndex].username;
    const hand = playerHands[username];

    // Validate Indices
    if (!hand || indices.some((i) => i < 0 || i >= hand.length)) {
      console.log(`Play_turn: Invalid indices provided by ${username}.`);
      return;
    }

    // Get Cards
    const cardsToPlay = indices.map((i) => hand[i]);

    // Identify Combo
    const combo = identifyCombo(cardsToPlay); // { type, value }
    if (!combo) {
      console.log(
        `Play_turn: Invalid combination played by ${username}. Cards: ${JSON.stringify(
          cardsToPlay
        )}`
      );
      return;
    }

    // Validation against Active Table
    const activeTableCards = tableCards.slice(roundStartIndex);

    if (activeTableCards.length === 0) {
      // New Round (or Start of Game)

      // Must play 3 of Clubs check (First turn of game)
      if (tableCards.length === 0 && roundStartIndex === 0) {
        // NEW: Must be playing Single
        if (combo.type !== "single") {
          console.log(
            `Play_turn: ${username} cannot start game with a Combo. Must play a single card.`
          );
          return;
        }

        // Enforce 3 of Clubs presence
        // "Start with 3 of Clubs". Using IdentifyCombo means we have cardsToPlay.
        const has3Clubs = cardsToPlay.some(
          (c) => c.rank === "3" && c.suit === "clubs"
        );
        if (!has3Clubs) {
          console.log(
            `Play_turn: ${username} must play 3 of Clubs in the first hand.`
          );
          return;
        }
      }

      // Allowed. Set Active State.
      // Note: Logic allows setting the Type (Single or Set).
    } else {
      // Responding to existing play
      // CRITICAL: Validate based on TYPE, not length
      // (5 singles on table should still accept singles, not require 5-card combos)

      if (combo.type !== activeComboType) {
        console.log(
          `Play_turn: ${username} must play ${activeComboType} to match active table. Played: ${combo.type}.`
        );
        return;
      }

      // Verify Value Logic
      if (combo.type === "single") {
        // Standard single check
        if (combo.value <= activeComboValue) {
          console.log(
            `Play_turn: ${username}'s single card (${combo.value}) is too small. Active: ${activeComboValue}.`
          );
          return;
        }
      } else {
        // Set Logic (Straight/Triplet/Quads)
        // Already verified type matches above

        // Compare Values (Check higher)
        console.log(
          `[DEBUG] Set Comparison: Type=${combo.type}, Played=${combo.value}, Active=${activeComboValue}`
        );

        if (combo.value <= activeComboValue) {
          console.log(
            `Play_turn: ${username}'s combo value (${combo.value}) is too small. Active: ${activeComboValue}.`
          );
          return;
        }
      }
    }

    // Execute Move

    // SAVE STATE BEFORE MOVING
    saveGameState();

    // Remove from hand (Indices must be handled carefully as splicing shifts indices!)
    // Sort indices Descending to splice safely
    const sortedIndices = [...indices].sort((a, b) => b - a);
    for (const idx of sortedIndices) {
      playerHands[username].splice(idx, 1);
    }

    // Add to table
    tableCards.push(...cardsToPlay);

    // Track play history
    playHistory.push({ player: username, cardCount: cardsToPlay.length });

    // Update State
    activeComboType = combo.type;
    activeComboValue = combo.value;

    // Update Turn (Anti-clockwise)
    turnIndex = (turnIndex - 1 + 3) % 3;

    lastPlayerToPlay = username;
    lastActor = username; // This player acted

    // Broadcast update
    const actionText =
      combo.type === "single"
        ? `${username} played ${cardsToPlay[0].rank} of ${cardsToPlay[0].suit}`
        : `${username} played ${combo.type}`;

    io.emit("game_update", {
      turnIndex,
      tableCards,
      roundStartIndex,
      playHistory,
      activeComboType, // Broadcast Active Type
      activeComboValue, // Broadcast Active Value
      players: players.map((p) => ({
        username: p.username,
        cardCount: playerHands[p.username].length,
      })),
      lastAction: actionText,
      playerUndoCounts, // Send undo counts
    });

    // Also update the player's own hand privately
    socket.emit("hand_update", playerHands[username]);
    // Update Undo Counts for everyone (we can include in players list or separate event)
    io.emit("undo_update", playerUndoCounts);

    // Lock turn for 3 seconds (undo window)
    turnLocked = true;
    if (turnLockTimeout) clearTimeout(turnLockTimeout);

    turnLockTimeout = setTimeout(() => {
      turnLocked = false;
      io.emit("turn_unlocked");
      console.log("Turn unlocked - next player can now act");
    }, 3000);

    // Check for winner (player has no cards left)
    if (playerHands[username].length === 0) {
      console.log(`${username} has won the game!`);
      gameActive = false; // Prevent further plays
      if (turnLockTimeout) clearTimeout(turnLockTimeout);
      turnLocked = false;
      io.emit("game_won", { winner: username });
    }
  });

  socket.on("undo_turn", () => {
    // identify player
    const pIndex = players.findIndex((p) => p.id === socket.id);
    if (pIndex === -1) {
      console.log(`Undo_turn: Player with socket ID ${socket.id} not found.`);
      return;
    }
    const username = players[pIndex].username;

    // Validate Undo
    // 1. Must implement "3 Undos Only"
    if ((playerUndoCounts[username] || 0) <= 0) {
      console.log(`Undo_turn: ${username} has no undos left.`);
      return;
    }

    // 2. Must be the last actor
    if (lastActor !== username) {
      console.log(
        `Undo_turn: ${username} is not the last actor (${lastActor}). Cannot undo.`
      );
      return;
    }

    // 3. Must have previous state in history
    if (gameHistory.length === 0) {
      console.log(
        `Undo_turn: No previous game state to undo to for ${username}.`
      );
      return;
    }

    // Execute Undo
    const previousState = gameHistory.pop(); // Get the last state
    if (!previousState) {
      // Should not happen if gameHistory.length > 0
      console.log(
        `Undo_turn: Failed to retrieve previous state for ${username}.`
      );
      return;
    }

    // Restore state
    tableCards = previousState.tableCards;
    playerHands = previousState.playerHands;
    turnIndex = previousState.turnIndex;
    activeComboType = previousState.activeComboType;
    activeComboValue = previousState.activeComboValue;
    roundStartIndex = previousState.roundStartIndex;
    lastPlayerToPlay = previousState.lastPlayerToPlay;
    lastActor = previousState.lastActor; // Restore lastActor from previous state

    // Decrement undo count for the player who initiated the undo
    playerUndoCounts[username] = (playerUndoCounts[username] || 0) - 1;
    console.log(
      `Undo_turn: ${username} performed an undo. Remaining undos: ${playerUndoCounts[username]}.`
    );

    // Broadcast update
    io.emit("game_update", {
      turnIndex,
      tableCards,
      roundStartIndex,
      activeComboType,
      players: players.map((p) => ({
        username: p.username,
        cardCount: playerHands[p.username].length,
      })),
      lastAction: `${username} undid their last move.`,
      playerUndoCounts, // Send updated undo counts
    });

    // Also update the player's own hand privately
    socket.emit("hand_update", playerHands[username]);
    io.emit("undo_update", playerUndoCounts); // Explicitly send undo counts update
  });

  socket.on("pass_turn", () => {
    // Identify player
    const pIndex = players.findIndex((p) => p.id === socket.id);
    if (pIndex === -1) {
      console.log(`Pass_turn: Player with socket ID ${socket.id} not found.`);
      return; // Not found
    }
    if (pIndex !== turnIndex) {
      console.log(
        `Pass_turn: Not player ${players[pIndex].username}'s turn to pass. Current turn is ${players[turnIndex].username}.`
      );
      return;
    }

    const username = players[pIndex].username;

    // SAVE STATE BEFORE MOVING
    saveGameState();

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

    io.emit("game_update", {
      turnIndex,
      tableCards,
      roundStartIndex,
      activeComboType, // Persist or Null
      activeComboValue, // Persist or 0
      players: players.map((p) => ({
        username: p.username,
        cardCount: playerHands[p.username].length,
      })),
      lastAction: actionMessage,
      playerUndoCounts,
    });
  });

  socket.on("request_restart", () => {
    if (!gameActive) return;
    const p = players.find((p) => p.id === socket.id);
    if (!p) return;

    console.log(`${p.username} requested restart`);
    restartRequester = p.username;
    restartVotes.clear();
    restartVotes.add(p.username); // Requester implicitly votes yes

    // Broadcast to all
    io.emit("restart_requested", { requester: p.username });
    io.emit("restart_vote_update", { count: restartVotes.size });
  });

  socket.on("vote_restart", (vote: boolean) => {
    if (!gameActive) return;
    const p = players.find((p) => p.id === socket.id);
    if (!p) return;

    if (vote) {
      restartVotes.add(p.username);
      console.log(`${p.username} voted YES. Total: ${restartVotes.size}`);
      io.emit("restart_vote_update", { count: restartVotes.size });

      if (restartVotes.size === 3) {
        // ALL YES -> RESTART
        console.log("Restarting Game...");

        // Reset State (Similar to Start Game)
        const deck = shuffleDeck(generateDeck());
        const [h1, h2, h3] = dealCards(deck);

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
        const p1Has = h1.some((c) => c.rank === "3" && c.suit === "clubs");
        const p2Has = h2.some((c) => c.rank === "3" && c.suit === "clubs");
        const p3Has = h3.some((c) => c.rank === "3" && c.suit === "clubs");

        if (p1Has) turnIndex = 0;
        else if (p2Has) turnIndex = 1;
        else turnIndex = 2;

        // Broadcast Start
        players.forEach((player) => {
          io.to(player.id).emit("game_started", {
            hand: playerHands[player.username],
            turnIndex,
            tableCards: [],
            roundStartIndex: 0,
            players: players.map((pl) => ({
              username: pl.username,
              cardCount: playerHands[pl.username].length,
            })),
          });
        });

        restartVotes.clear();
        restartRequester = "";
      }
    } else {
      // Voted NO -> Cancel Restart
      console.log(`${p.username} voted NO. Restart cancelled.`);
      io.emit("restart_cancelled");
      restartVotes.clear();
      restartRequester = "";
    }
  });

  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);
    // Only remove if game NOT active?
    // If game is active, we sort of want to keep their spot "reserved" by username.
    // If we remove them, players.length drops to 2.
    // However, if we don't remove, the list stays 3.
    // If user reloads, disconnect fires -> connect fires.
    // Standard approach: Remove from socket list, but keep game state.

    if (!gameActive) {
      players = players.filter((p) => p.id !== socket.id);
      io.emit("player_update", players);
    } else {
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
