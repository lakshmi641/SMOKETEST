/**
 * Spell Check Service
 * 
 * Provides utility functions for fuzzy matching and suggestions.
 * Uses Levenshtein distance algorithm.
 */

export class SpellCheckService {
    /**
     * Calculate Levenshtein distance between two strings
     */
    static getLevenshteinDistance(a: string, b: string): number {
        const matrix: number[][] = [];

        // Increment along the first column of each row
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        // Increment each column in the first row
        for (let j = 0; j <= a.length; j++) {
            matrix[0]![j] = j;
        }

        // Fill in the rest of the matrix
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                const row = matrix[i];
                const prevRow = matrix[i - 1];
                if (!row || !prevRow) continue;

                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    row[j] = prevRow[j - 1]!;
                } else {
                    row[j] = Math.min(
                        prevRow[j - 1]! + 1, // substitution
                        Math.min(
                            row[j - 1]! + 1, // insertion
                            prevRow[j]! + 1 // deletion
                        )
                    );
                }
            }
        }

        const lastRow = matrix[b.length];
        return lastRow ? (lastRow[a.length] ?? a.length) : a.length;
    }

    /**
     * Calculate similarity score between 0 and 1
     */
    static getSimilarity(a: string, b: string): number {
        const s1 = a.toLowerCase().trim();
        const s2 = b.toLowerCase().trim();

        if (s1 === s2) return 1.0;

        const maxLength = Math.max(s1.length, s2.length);
        if (maxLength === 0) return 1.0;

        // If one is contained in the other, boost the score
        if (s1.length > 3 && (s2.includes(s1) || s1.includes(s2))) {
            const ratio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
            // Mix Levenshtein distance with containment boost
            const distance = this.getLevenshteinDistance(s1, s2);
            const baseScore = (maxLength - distance) / maxLength;
            return Math.max(baseScore, ratio * 0.9);
        }

        const distance = this.getLevenshteinDistance(s1, s2);
        return (maxLength - distance) / maxLength;
    }

    /**
     * Find best matches from a list of candidates
     */
    static findBestMatches(
        input: string,
        candidates: { label: string; value: any }[],
        minScore: number = 0.6,
        maxResults: number = 3
    ): { label: string; value: any; score: number }[] {
        if (!input) return [];

        const matches = candidates
            .map(c => ({
                ...c,
                score: this.getSimilarity(input, c.label)
            }))
            .filter(m => m.score >= minScore)
            .sort((a, b) => b.score - a.score);

        return matches.slice(0, maxResults);
    }
}
