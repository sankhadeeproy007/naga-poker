export interface Card {
  suit: string;
  rank: string;
}

// Ranks Order: 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

const getRankIndex = (rank: string): number => RANKS.indexOf(rank);

// Calculate Absolute Value for comparison (Same as gameUtils but handy here)
// But we should reuse if possible. For now, duplication is safer than circular deps if not managed well.
// Actually, let's just export the Identification functions.

// Identify Combo Type
// Returns: 'single', 'straight', 'triplet', 'quads', or null (invalid)
// Also returns a "Value" for comparison.
export interface ComboResult {
    type: 'single' | 'straight' | 'triplet' | 'quads';
    value: number; // For comparison within type
}

export function identifyCombo(cards: Card[]): ComboResult | null {
    // RULE: Rank '2' cannot be part of ANY combo. It can only be played as a Single.
    if (cards.length > 1) {
        if (cards.some(c => c.rank === '2')) {
            return null; 
        }
    }

    if (cards.length === 1) {
        // Single
        // Value: RankIndex * 10 + SuitIndex
        return { type: 'single', value: getCardAbsoluteValue(cards[0]) };
    }
    
    if (cards.length === 5) {
        // Check 4 Cards (Quads)
        // 4 of rank A, 1 of rank B
        const quads = checkQuads(cards);
        if (quads) return { type: 'quads', value: quads }; // Value = RankIndex of the Quad

        // Check Full House (Triplet)
        const triplet = checkFullHouse(cards);
        if (triplet) return { type: 'triplet', value: triplet }; // Value = RankIndex of the Triplet

        // Check Straight
        const straight = checkStraight(cards);
        if (straight) return { type: 'straight', value: straight }; // Value = RankIndex of Highest Card
    }

    return null;
}

// --- HELPERS ---
// Suit Order: Diamonds(1) < Clubs(2) < Hearts(3) < Spades(4)?
// User implementation was: diamonds=1, clubs=2, hearts=3, spades=4.
const SUIT_VALS: Record<string, number> = { 'diamonds': 1, 'clubs': 2, 'hearts': 3, 'spades': 4 };

function getCardAbsoluteValue(card: Card): number {
    const rIdx = RANKS.indexOf(card.rank);
    const sIdx = SUIT_VALS[card.suit] || 0;
    return rIdx * 10 + sIdx;
}

function checkQuads(cards: Card[]): number | null {
    // 4 same rank, 1 diff
    const counts = getRankCounts(cards);
    // Should have 1 rank with 4 count
    for (const r in counts) {
        if (counts[r] === 4) return RANKS.indexOf(r);
    }
    return null;
}

function checkFullHouse(cards: Card[]): number | null {
    // 3 same rank, 2 same rank
    const counts = getRankCounts(cards);
    // Should have 1 rank with 3 count, 1 with 2
    let rank3 = '';
    let hasRank2 = false;
    
    for (const r in counts) {
        if (counts[r] === 3) rank3 = r;
        if (counts[r] === 2) hasRank2 = true;
    }
    
    if (rank3 && hasRank2) return RANKS.indexOf(rank3);
    return null;
}

function checkStraight(cards: Card[]): number | null {
    // 5 sequential ranks.
    // Sort by rank index
    const sorted = [...cards].sort((a, b) => getRankIndex(a.rank) - getRankIndex(b.rank));
    
    // Check sequence
    const firstIdx = getRankIndex(sorted[0].rank);
    for (let i = 1; i < 5; i++) {
        if (getRankIndex(sorted[i].rank) !== firstIdx + i) return null;
    }
    
    // Return Value of Highest Card (Last one)
    // Big Two Rule: Straight determined by Highest Card?
    // "Ranked by the highest card."
    return getCardAbsoluteValue(sorted[4]); 
}

function getRankCounts(cards: Card[]) {
    const c: Record<string, number> = {};
    for (const card of cards) {
        const r = card.rank;
        c[r] = (c[r] || 0) + 1;
    }
    return c;
}
