export type Suit = 'diamonds' | 'clubs' | 'hearts' | 'spades';
export type Rank = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2';

export interface Card {
  suit: Suit;
  rank: Rank;
}

const SUITS: Suit[] = ['diamonds', 'clubs', 'hearts', 'spades'];
const RANKS: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

// Power order: 3 (lowest) -> ... -> 2 (highest)
const RANK_VALUE: Record<Rank, number> = {
  '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, 
  '10': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12, '2': 13
};

// Suit priority: Spades > Hearts > Clubs > Diamonds
const SUIT_VALUE: Record<Suit, number> = {
  'diamonds': 1,
  'clubs': 2,
  'hearts': 3,
  'spades': 4
};

export function generateDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      // Remove 3 of Diamonds
      if (rank === '3' && suit === 'diamonds') {
        continue;
      }
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

export function dealCards(deck: Card[]): [Card[], Card[], Card[]] {
  // 51 cards / 3 = 17 each
  const hand1 = deck.slice(0, 17);
  const hand2 = deck.slice(17, 34);
  const hand3 = deck.slice(34, 51);
  return [hand1, hand2, hand3];
}

// Returns a value for sorting. Higher is better.
export function getCardAbsoluteValue(card: Card): number {
  // Base value by rank (weight 100), tie-break by suit (weight 1)
  // e.g. 3 Clubs = 1*10 + 2 = 12
  // e.g. 2 Spades = 13*10 + 4 = 134
  return RANK_VALUE[card.rank] * 10 + SUIT_VALUE[card.suit];
}
