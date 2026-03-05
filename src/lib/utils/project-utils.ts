/**
 * Project Utilities
 * 
 * Helper functions for project-related logic, such as project code generation.
 */

/**
 * Generates a smart project code from a project name, following Jira-like rules.
 * 
 * Rules:
 * 1. If multiple words (e.g., "Project Asta"), take the first letter of each word.
 * 2. If one word (e.g., "demo"), take the first 3 letters.
 * 3. Always include any numbers found in the name (e.g., "Demo3" -> "DE3", "Project 1" -> "PRO1").
 * 4. Return value is always uppercase.
 * 
 * @param name - The project name
 * @returns A 2-6 character project code
 */
export function generateProjectCode(name: string): string {
    if (!name || typeof name !== 'string') return 'PRJ';

    // Extract all numbers found in the string
    const numbers = name.match(/\d+/g)?.join('') || '';

    // Extract alphabetic words only
    const alphaOnly = name.replace(/[^a-zA-Z ]/g, ' ').trim().toUpperCase();
    const alphaWords = alphaOnly.split(/\s+/).filter(w => w.length > 0);

    // Case 1: Multiple alpha words (e.g., "Project Asta", "My New Project")
    if (alphaWords.length >= 2) {
        const initials = alphaWords.map(w => w[0]).join('');
        // "Project Asta" -> "PA"
        // "My New Project" -> "MNP"
        return (initials + numbers).substring(0, 6);
    }

    // Case 2: One major alpha word (e.g., "demo", "Project 1", "Demo3")
    if (alphaWords.length === 1) {
        const word = alphaWords[0];
        if (word && numbers) {
            // If there's a word and numbers, we want to combine them intelligently.
            // Rule: If word is long (> 5), take 3 letters + numbers. If short, take 2 letters + numbers.
            const prefixLen = word.length > 5 ? 3 : 2;
            return word.substring(0, prefixLen) + numbers;
        }
        if (word) {
            // Just one word, no numbers (e.g., "demo")
            return word.substring(0, 3);
        }
    }

    // Case 3: No alphabetic words, just numbers or special chars
    return numbers ? ('PRJ' + numbers).substring(0, 6) : 'PRJ';
}
