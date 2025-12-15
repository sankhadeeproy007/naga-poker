import type { CardData, Rank } from '../types';

// Ranks Order: 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2
const RANKS: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

// Helper to get index of rank
const getRankIndex = (rank: Rank): number => RANKS.indexOf(rank);

// Sort helper: ascending rank, then suit (suit order doesn't strictly matter for finding sets, but good for display)
// Uses simple rank index comparison.
export const sortCards = (cards: CardData[]): CardData[] => {
    return [...cards].sort((a, b) => getRankIndex(a.rank) - getRankIndex(b.rank));
};

// --- SINGLE HELPERS ---
const getCardsByRank = (cards: CardData[]): Record<Rank, CardData[]> => {
    const grouped: Record<string, CardData[]> = {};
    for (const c of cards) {
        if (!grouped[c.rank]) grouped[c.rank] = [];
        grouped[c.rank].push(c);
    }
    return grouped as Record<Rank, CardData[]>;
};

// --- FIND STRAIGHTS (5 cards sequential) ---
export const findStraights = (hand: CardData[]): CardData[][] => {
    const straights: CardData[][] = [];
    if (hand.length < 5) return [];

    // const sorted = sortCards(hand); // Unused
    
    // We need unique ranks to iterate easily, but need to reconstruct actual cards.
    // Actually, simple sliding window approach or recursion is better if we have duplicates of rank.
    // Simpler approach: Iterate valid Start Ranks. Check if we have ranks.
    // Valid start indices: 0 (3) up to 8 (10). (10-J-Q-K-A-2 is 6 cards? No. 10,J,Q,K,A is 5. J,Q,K,A,2 is 5.)
    // Start index max = 12 (2). 12-4 = 8. So index 0 to 8.
    // RULE: Rank '2' cannot be in a straight.
    // Max Rank allowed in straight is 'A' (Index 11).
    // So set must end at max Index 11.
    // i + 4 <= 11 => i <= 7.
    
    for (let i = 0; i <= 7; i++) {
        // We need 1 card of Rank[i], 1 of Rank[i+1]... Rank[i+4]
        const reqRanks = [RANKS[i], RANKS[i+1], RANKS[i+2], RANKS[i+3], RANKS[i+4]];
        
        // Find all matching cards in hand
        const matches: CardData[][] = reqRanks.map(r => hand.filter(c => c.rank === r));
        
        // If any rank is missing, cannot form this straight
        if (matches.some(m => m.length === 0)) continue;
        
        // Generate combinations.
        // If we have [3s, 3h], [4s], [5s], [6s], [7s].
        // We can form 3s-4s-5s-6s-7s AND 3h-4s-5s-6s-7s.
        // User screenshot implies "Show 45678, 56789...". Maybe just show ONE example per rank set?
        // Or show all variations?
        // "show the available straights... it should show 45678, 56789" -> Suggests showing distinct RANK sets.
        // It does not explicitly say show every suit variation.
        // "Show available respective set".
        // I'll return ONE valid combination for each Rank-Span. (Preferably highest suit?)
        // Wait, different suits have different values. 
        // If I have 3s and 3h (let's say s > h), usually you want to play the one that wins?
        // Or you might want to save a high card.
        // Let's simplified: Return ALL Valid Straights? That might be too many (2^5 = 32).
        // Let's return the "Highest Value" version of that Straight? (Max suits).
        // Actually, user UI just says "Straights". I can list them by Top Card.
        // Let's gather just ONE straight per rank-range for the UI button label?
        // But the modal needs to let them pick.
        // IF I have multiple 3s, I technically have multiple straights 3-7. 
        // I will return ALL combinations? That's safest for "Play specific set".
        // But constrained to max 10 combos maybe?
        
        // Let's write a generator for combinations
        const combos = cartesianProduct(matches);
        straights.push(...combos);
    }
    
    return straights;
};

// --- FIND TRIPLETS (FULL HOUSES) ---
// 3 of one rank + 2 of another
export const findFullHouses = (hand: CardData[]): CardData[][] => {
    const fullHouses: CardData[][] = [];
    const byRank = getCardsByRank(hand);
    const ranks = Object.keys(byRank) as Rank[];
    
    // Iterate Triplets
    for (const r3 of ranks) {
        if (r3 === '2') continue; // 2 cannot be part of combo
        if (byRank[r3].length >= 3) {
            // Found a triplet candidate
            // Now need a Pair (r2)
            for (const r2 of ranks) {
                if (r2 === r3) continue;
                if (r2 === '2') continue; // 2 cannot be part of combo
                if (byRank[r2].length >= 2) {
                    // Valid Full House: 3 of r3 + 2 of r2
                    // Generate specific combinations?
                    // Again, 3 choose 3 * 2 choose 2.
                    // If we have 4 of r3? 4 choose 3 = 4 combos.
                    // If we have 3 of r2? 3 choose 2 = 3 combos.
                    // Total 12 combos.
                    // Let's just create ONE combination to simplify UI for now: 
                    // Best Suite Triplet + Best Suite Pair? or First found.
                    // I will generate all for completeness logic, filtering later if needed.
                    
                    const triples = getCombinations(byRank[r3], 3);
                    const pairs = getCombinations(byRank[r2], 2);
                    
                    for (const t of triples) {
                        for (const p of pairs) {
                           fullHouses.push([...t, ...p]);
                        }
                    }
                }
            }
        }
    }
    return fullHouses;
};

// --- FIND QUADS (4 Cards + 1) ---
export const findQuads = (hand: CardData[]): CardData[][] => {
    const quads: CardData[][] = [];
    const byRank = getCardsByRank(hand);
    const ranks = Object.keys(byRank) as Rank[];

    for (const r4 of ranks) {
        if (r4 === '2') continue; // 2 cannot be part of combo
        if (byRank[r4].length === 4) { // Max 4 cards of a rank exists
             const fourCards = byRank[r4];
             
             // Need 1 kicker from ANY other rank
             // Rule: Kicker also cannot be '2'? 
             // "2 cannot be part of any combo". Yes.
             for (const kickerRank of ranks) {
                 if (kickerRank === r4) continue;
                 if (kickerRank === '2') continue; 
                 // Each card in kickerRank is a valid kicker
                 for (const kicker of byRank[kickerRank]) {
                     quads.push([...fourCards, kicker]);
                 }
             }
        }
    }
    return quads;
};

// --- UTILS ---
function cartesianProduct<T>(arrays: T[][]): T[][] {
    return arrays.reduce((acc, curr) => {
        return acc.flatMap(a => curr.map(c => [...a, c]));
    }, [[]] as T[][]);
}

function getCombinations<T>(arr: T[], k: number): T[][] {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    
    // Pick first
    const first = arr[0];
    const rest = arr.slice(1);
    
    // Combinations with first
    const withFirst = getCombinations(rest, k - 1).map(c => [first, ...c]);
    
    // Combinations without first
    const withoutFirst = getCombinations(rest, k);
    
    return [...withFirst, ...withoutFirst];
}

// Helper values for comparison
const SUIT_VALS: Record<string, number> = { 'diamonds': 1, 'clubs': 2, 'hearts': 3, 'spades': 4 };

export function getCardValue(c: CardData) {
    // Standardize to match Server: Rank Index (0-12) * 10 + Suit
    return getRankIndex(c.rank) * 10 + SUIT_VALS[c.suit];
}

// Helper to get value of a combo for comparison
export function getComboValue(cards: CardData[], type: 'Straight' | 'Triplet' | '4 Cards'): number {
    const sorted = sortCards(cards);
    
    if (type === 'Straight') {
        // Highest card value (Last one in sorted array)
        return getCardValue(sorted[4]); 
    }
    
    if (type === 'Triplet') {
        // Full House: 3 matching rank.
        // Return Rank Index to match Server Logic (0-12)
        const counts = getRankCounts(cards);
        for (const r in counts) {
            if (counts[r] === 3) return getRankIndex(r as Rank);
        }
    }
    
    if (type === '4 Cards') {
        // Quads: 4 matching rank.
        // Return Rank Index to match Server Logic (0-12)
        const counts = getRankCounts(cards);
        for (const r in counts) {
            if (counts[r] === 4) return getRankIndex(r as Rank);
        }
    }
    
    return 0;
}

function getRankCounts(cards: CardData[]) {
    const c: Record<string, number> = {};
    for (const card of cards) {
        const r = card.rank;
        c[r] = (c[r] || 0) + 1;
    }
    return c;
}
