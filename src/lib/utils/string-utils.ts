/**
 * List of known acronyms/abbreviations to preserve when source data is already lowercase.
 * This is a fallback — Approach 1 (preserve original casing) handles most cases automatically.
 */
const ACRONYMS = new Set([
    'CEO', 'CTO', 'CFO', 'COO', 'CMO', 'CPO', 'CIO', 'CHRO', 'CLO', 'CSO',
    'VP', 'SVP', 'EVP', 'AVP',
    'MD', 'GM', 'DGM', 'AGM',
    'HR', 'IT', 'PR', 'QA', 'QC', 'R&D', 'RFT',
    'SEO', 'SEM', 'SMM', 'UI', 'UX', 'API', 'ERP', 'CRM', 'SCM',
    'BPO', 'KPO', 'LPO',
    'MFG', 'OPS', 'FIN', 'ACT', 'ADM', 'MGMT',
    'AM', 'PM', 'SM', 'TL', 'DM', 'RM', 'BM',
])

/**
 * Converts a string to Title Case using Approach 1 (Preserve Original Casing):
 *
 * Step 1 — Scan the original input and record any ALL-CAPS words (2+ letters).
 *           e.g. "Deputy Manager-MIS Dept" → preserve {"MIS"}
 * Step 2 — Apply title case transformation.
 * Step 3 — Restore preserved ALL-CAPS words back to uppercase.
 * Step 4 — Also apply explicit ACRONYMS dictionary as a fallback for
 *           lowercase source data (e.g. "seo" → "SEO").
 *
 * Examples:
 *   "SEO Manager"              → "SEO Manager"   (Approach 1: SEO was already caps)
 *   "seo manager"              → "SEO Manager"   (Fallback dictionary)
 *   "deputy manager-MIS Dept"  → "Deputy Manager-MIS Dept"  (Approach 1: MIS preserved)
 *   "Business Development-CSR" → "Business Development-CSR" (Approach 1: CSR preserved)
 *   "cto"                      → "CTO"           (Fallback dictionary)
 */
export function toTitleCase(str: string | undefined | null): string {
    if (!str) return str as string

    // Step 1: Extract ALL-CAPS words from the original string (2+ letter sequences)
    // Matches words that are all uppercase letters (ignoring single-letter words like "A")
    const preservedCaps = new Set<string>()
    str.replace(/\b([A-Z]{2,})\b/g, (_, word) => {
        preservedCaps.add(word)
        return word
    })

    // Step 2 & 3 & 4: Apply title case, checking both preserved caps and fallback dictionary
    return str
        .toLowerCase()
        .replace(/(?:^|[\s\-\/&])(\w+)/g, (match, word) => {
            const prefix = match.slice(0, match.length - word.length)
            const upper = word.toUpperCase()
            // Restore if it was originally all-caps OR is in the fallback dictionary
            if (preservedCaps.has(upper) || ACRONYMS.has(upper)) {
                return prefix + upper
            }
            return prefix + word.charAt(0).toUpperCase() + word.slice(1)
        })
}

