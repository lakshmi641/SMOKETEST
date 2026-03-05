import { SpellCheckService } from '../spell-check-service';

describe('SpellCheckService', () => {
    describe('getLevenshteinDistance', () => {
        it('should return 0 for identical strings', () => {
            expect(SpellCheckService.getLevenshteinDistance('test', 'test')).toBe(0);
        });

        it('should return correct distance for insertions', () => {
            expect(SpellCheckService.getLevenshteinDistance('test', 'tests')).toBe(1);
        });

        it('should return correct distance for deletions', () => {
            expect(SpellCheckService.getLevenshteinDistance('tests', 'test')).toBe(1);
        });

        it('should return correct distance for substitutions', () => {
            expect(SpellCheckService.getLevenshteinDistance('test', 'text')).toBe(1);
        });

        it('should be case sensitive in distance calculation (raw function)', () => {
            expect(SpellCheckService.getLevenshteinDistance('Test', 'test')).toBe(1);
        });
    });

    describe('getSimilarity', () => {
        it('should return 1.0 for identical strings (ignoring case)', () => {
            expect(SpellCheckService.getSimilarity('Sathwik', 'sathwik ')).toBe(1.0);
        });

        it('should return 0.0 for completely different strings', () => {
            expect(SpellCheckService.getSimilarity('abc', 'xyz')).toBe(0.0);
        });

        it('should return high score for minor typos', () => {
            const score = SpellCheckService.getSimilarity('Sathwik Kumar', 'Sathwk Kumar');
            expect(score).toBeGreaterThan(0.8);
        });
    });

    describe('findBestMatches', () => {
        const candidates = [
            { label: 'Sathwik Kumar', value: '1' },
            { label: 'Divya Singh', value: '2' },
            { label: 'Engineering', value: '3' }
        ];

        it('should return the correct best match', () => {
            const matches = SpellCheckService.findBestMatches('Sathwik K', candidates);
            expect(matches[0]?.label).toBe('Sathwik Kumar');
            expect(matches[0]?.score).toBeGreaterThan(0.6);
        });

        it('should return no matches below threshold', () => {
            const matches = SpellCheckService.findBestMatches('Unknown', candidates, 0.9);
            expect(matches).toHaveLength(0);
        });
    });
});
