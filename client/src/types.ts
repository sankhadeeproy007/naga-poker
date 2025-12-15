export type Suit = 'diamonds' | 'clubs' | 'hearts' | 'spades';
export type Rank = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2';

export interface CardData {
  suit: Suit;
  rank: Rank;
}

export interface Player {
  username: string;
  cardCount?: number; // Optional for lobby, required for game
}

export interface PlayerPublic {
  username: string;
}

export interface GameStartPayload {
    hand: CardData[];
    turnIndex: number;
    tableCards: CardData[];
    roundStartIndex?: number;
    playHistory?: Array<{ player: string, cardCount: number }>;
    activeComboType?: 'single' | 'straight' | 'triplet' | 'quads' | null;
    activeComboValue?: number;
    players: { username: string; cardCount: number }[];
    playerUndoCounts?: Record<string, number>;
}

export interface GameUpdatePayload {
  turnIndex: number;
  tableCards: CardData[];
  players: Player[];
  lastAction: string;
  roundStartIndex?: number;
  activeComboType?: 'single' | 'straight' | 'triplet' | 'quads' | null;
  activeComboValue?: number;
  playerUndoCounts?: Record<string, number>;
}
