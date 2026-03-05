/**
 * Date Parser Utility
 * 
 * Parses dates from various formats commonly found in Excel files.
 * Supports auto-detection of date format from sample values.
 * 
 * @module lib/utils/excel/date-parser
 */

import { parse, isValid, format } from 'date-fns';

/**
 * Supported date formats for auto-detection.
 */
export type DateFormat =
    | 'ISO'         // YYYY-MM-DD
    | 'DMY_SLASH'   // DD/MM/YYYY
    | 'MDY_SLASH'   // MM/DD/YYYY
    | 'DMY_DASH'    // DD-MM-YYYY
    | 'EXCEL'       // Excel serial number

// ============================================================
// DATE FORMAT PATTERNS
// ============================================================

/**
 * Regular expressions for detecting date formats.
 */
const DATE_PATTERNS = {
    // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD (Year must be 4 digits for ISO to avoid ambiguity with DMY)
    ISO: /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/,
    // YYYY-DD-MM or YYYY/DD/MM
    YDM: /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/,
    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY or DD/MM/YY
    DMY: /^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})$/,
    // MM/DD/YYYY (for US format detection) or MM/DD/YY
    MDY: /^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})$/,
    // Excel serial number (days since 1900-01-01)
    EXCEL_SERIAL: /^\d{5}$|^\d{5}\.\d+$/,
}

// ============================================================
// MAIN FUNCTIONS
// ============================================================

/**
 * Parse a date string from various formats into ISO format (YYYY-MM-DD).
 * 
 * @param dateStr - Raw date string from Excel
 * @returns ISO date string (YYYY-MM-DD) or null if invalid
 * 
 * @example
 * parseDate('2024-12-15')    // '2024-12-15'
 * parseDate('15/12/2024')    // '2024-12-15'
 * parseDate('12/15/2024')    // '2024-12-15' (US format)
 * parseDate('45641')         // '2024-12-15' (Excel serial)
 * parseDate('invalid')       // null
 */
export function parseDate(dateStr: string | null | undefined, formatHint?: DateFormat | null): string | null {
    if (!dateStr || typeof dateStr !== 'string') {
        return null
    }

    const trimmed = dateStr.trim()
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
        return null
    }

    console.log(`[DateParser] parseDate: Input="${trimmed}", Format hint=${formatHint || 'none'}`);

    // 0. Handle already normalized ISO (YYYY-MM-DD) or reported flipped ISO (YYYY-DD-MM)
    if (trimmed.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const parts = trimmed.split('-').map(Number);
        const [y, m, d] = parts;
        if (m! > 12) {
            // YYYY-DD-MM flip
            return formatISODate(y!, d!, m!);
        }
        return formatISODate(y!, m!, d!);
    }

    // 1. Try ISO format (YYYY-MM-DD) or YYYY/MM/DD
    // Note: We check this before Excel serial because some 5-digit years might overlap, 
    // although rare in this context.
    const isoMatch = trimmed.match(DATE_PATTERNS.ISO)
    if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
        const year = parseInt(isoMatch[1])
        const v1 = parseInt(isoMatch[2])
        const v2 = parseInt(isoMatch[3])

        if (v1 > 12) {
            // YYYY-DD-MM 
            const result = formatISODate(year, v2, v1);
            console.log(`[DateParser] parseDate: ISO format (YYYY-DD-MM) ${trimmed} -> ${result}`);
            return result;
        } else {
            // YYYY-MM-DD
            const result = formatISODate(year, v1, v2);
            console.log(`[DateParser] parseDate: ISO format (YYYY-MM-DD) ${trimmed} -> ${result}`);
            return result;
        }
    }

    // 2. Try Excel serial number (5 digit number)
    if (DATE_PATTERNS.EXCEL_SERIAL.test(trimmed)) {
        const result = parseExcelSerial(parseFloat(trimmed));
        console.log(`[DateParser] parseDate: Excel serial ${trimmed} -> ${result}`);
        return result;
    }

    // 3. Try DD/MM/YYYY or MM/DD/YYYY
    const dmyPatterns = [DATE_PATTERNS.DMY, DATE_PATTERNS.MDY];
    let dmyMatch = null;
    for (const p of dmyPatterns) {
        dmyMatch = trimmed.match(p);
        if (dmyMatch) break;
    }

    if (dmyMatch && dmyMatch[1] && dmyMatch[2] && dmyMatch[3]) {
        const v1 = parseInt(dmyMatch[1])
        const v2 = parseInt(dmyMatch[2])
        const yStr = dmyMatch[3]
        let year = parseInt(yStr)

        // Expand 2-digit year (e.g. 26 -> 2026)
        if (yStr.length === 2) {
            const currentYear = new Date().getFullYear() % 100;
            // If year is <= 50, assume 20xx, otherwise 19xx
            year = year <= 50 ? 2000 + year : 1900 + year;
            console.log(`[DateParser] parseDate: Expanded 2-digit year ${yStr} -> ${year}`);
        }

        // 3a. Check strict constraints first (if one part > 12, it must be day)
        if (v1 > 12) {
            // DD/MM/YYYY (v1 is day)
            const result = formatISODate(year, v2, v1);
            console.log(`[DateParser] parseDate: DD/MM/YYYY (v1=${v1} > 12) ${trimmed} -> ${result}`);
            return result;
        } else if (v2 > 12) {
            // MM/DD/YYYY (v2 is day)
            const result = formatISODate(year, v1, v2);
            console.log(`[DateParser] parseDate: MM/DD/YYYY (v2=${v2} > 12) ${trimmed} -> ${result}`);
            return result;
        }

        // 3b. If ambiguous, use the provided format hint
        if (formatHint) {
            if (formatHint === 'DMY_SLASH' || formatHint === 'DMY_DASH') {
                const result = formatISODate(year, v2, v1); // v1 is Day
                console.log(`[DateParser] parseDate: Using format hint ${formatHint}, treating as DD/MM/YYYY ${trimmed} -> ${result}`);
                return result;
            } else if (formatHint === 'MDY_SLASH') {
                const result = formatISODate(year, v1, v2); // v1 is Month
                console.log(`[DateParser] parseDate: Using format hint ${formatHint}, treating as MM/DD/YYYY ${trimmed} -> ${result}`);
                return result;
            }
        }

        // 3c. Last resort: Defaults (Ambiguous e.g. 01/02/2026)
        // CRITICAL: Force DD/MM/YYYY (global default) to avoid US-centric swaps
        const result = formatISODate(year, v2, v1);
        console.log(`[DateParser] parseDate: Ambiguous date ${trimmed}, FORCING default to DD/MM/YYYY -> ${result}`);
        return result;
    }

    // 4. CRITICAL: Handle potential misinterpretation of native JS Date strings.
    // If the input looks like "Fri May 02 2026..." but it's from an ambiguous source, 
    // it might be a swapped date. However, we only do this if it contains '00:00:00' 
    // and we have a strong preference for DMY.
    if (trimmed.includes('00:00:00') && (trimmed.includes('GMT') || trimmed.includes('UTC'))) {
        const jsDate = new Date(trimmed);
        if (!isNaN(jsDate.getTime())) {
            // CRITICAL: For strings with GMT/UTC, we SHOULD use UTC methods 
            // because they likely came from a system-generated string which is already UTC.
            const year = jsDate.getUTCFullYear();
            const month = jsDate.getUTCMonth() + 1;
            const day = jsDate.getUTCDate();

            const result = formatISODate(year, month, day);
            console.log(`[DateParser] parseDate: Native JS Date string detected ${trimmed} -> ${result}`);
            return result;
        }
    }

    // 5. Final fallback for ISO-8601 or those with Month Names (e.g. '29 Jan 2026')
    if (trimmed.includes('T') || trimmed.includes('GMT') || trimmed.includes('Z') || /[a-z]/i.test(trimmed)) {
        const jsDate = new Date(trimmed)
        if (!isNaN(jsDate.getTime())) {
            // CRITICAL: For user-typed strings with month names and NO timezone, 
            // USE LOCAL date methods to avoid timezone shifts (e.g. 29 Jan IST -> 28 Jan UTC).
            const isISOWithTime = trimmed.includes('T') || trimmed.includes('Z');

            const result = isISOWithTime
                ? formatISODate(jsDate.getUTCFullYear(), jsDate.getUTCMonth() + 1, jsDate.getUTCDate())
                : formatISODate(jsDate.getFullYear(), jsDate.getMonth() + 1, jsDate.getDate());

            console.log(`[DateParser] parseDate: JS native parse ${trimmed} -> ${result} (Mode: ${isISOWithTime ? 'UTC' : 'Local'})`);
            return result;
        }
    }

    console.warn(`[DateParser] parseDate: Failed to parse "${trimmed}" (No pattern matched)`);
    return null
}

/**
 * Parse Excel serial date number to ISO date string.
 */
export function parseExcelSerial(serial: number): string | null {
    if (isNaN(serial) || serial < 1) {
        return null
    }

    // Excel's epoch is January 1, 1900
    // But Excel incorrectly treats 1900 as a leap year, so subtract 1 for dates after Feb 28, 1900
    const excelEpoch = new Date(1899, 11, 30) // Dec 30, 1899
    const millisecondsPerDay = 24 * 60 * 60 * 1000

    // Add the serial days to epoch
    const date = new Date(excelEpoch.getTime() + serial * millisecondsPerDay)

    return formatISODate(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate()
    )
}

/**
 * Detect the date format from a sample of date strings.
 */
export function detectDateFormat(samples: string[]): DateFormat | null {
    if (!samples || samples.length === 0) return null
    const validSamples = samples.filter(s => s && typeof s === 'string' && s.trim()).map(s => s.trim())
    if (validSamples.length === 0) return null

    console.log(`[DateParser] detectDateFormat: Analyzing ${validSamples.length} samples...`);

    if (validSamples.every(s => DATE_PATTERNS.EXCEL_SERIAL.test(s))) return 'EXCEL'
    if (validSamples.every(s => DATE_PATTERNS.ISO.test(s))) return 'ISO'

    const allDMY = validSamples.every(s => DATE_PATTERNS.DMY.test(s))
    if (allDMY) {
        const hasFirstOver12 = validSamples.some(s => {
            const match = s.match(DATE_PATTERNS.DMY)
            return match && match[1] && parseInt(match[1]) > 12
        })

        if (hasFirstOver12) return (validSamples[0]!.includes('/') || validSamples[0]!.includes('.')) ? 'DMY_SLASH' : 'DMY_DASH';

        // Strict DD/MM/YYYY preference: 
        // We REMOVE auto-switching to MDY (hasSecondOver12) to avoid swapping ambiguous dates like 1/2/2026.
        console.log(`[DateParser] detectDateFormat: Ambiguous or standard samples, forcing DMY_SLASH`);
        return (validSamples[0]!.includes('/') || validSamples[0]!.includes('.')) ? 'DMY_SLASH' : 'DMY_DASH'
    }
    return null
}

/**
 * Validate that a date string is valid and within reasonable bounds.
 * 
 * @param dateStr - ISO format date string (YYYY-MM-DD)
 * @returns true if valid
 */
export function isValidDate(dateStr: string | null): boolean {
    if (!dateStr) {
        return false
    }

    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
        return false
    }

    // Check reasonable bounds (1900 to 2100)
    const year = date.getFullYear()
    return year >= 1900 && year <= 2100
}

/**
 * Compare two dates.
 * 
 * @param date1 - First date (ISO format)
 * @param date2 - Second date (ISO format)
 * @returns -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareDates(date1: string, date2: string): -1 | 0 | 1 {
    const d1 = new Date(date1)
    const d2 = new Date(date2)

    if (d1 < d2) return -1
    if (d1 > d2) return 1
    return 0
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Format year, month, day into ISO date string.
 * Validates the date is real (e.g., Feb 30 is invalid).
 */
function formatISODate(year: number, month: number, day: number): string | null {
    // Validate ranges
    if (month < 1 || month > 12 || day < 1 || day > 31) {
        return null
    }

    // CRITICAL: Use Date.UTC to avoid local timezone shifts during validation
    const date = new Date(Date.UTC(year, month - 1, day))
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        // Date rolled over (e.g., Feb 30 became Mar 2)
        return null
    }

    // Format as YYYY-MM-DD
    const yyyy = year.toString()
    const mm = month.toString().padStart(2, '0')
    const dd = day.toString().padStart(2, '0')

    return `${yyyy}-${mm}-${dd}`
}

/**
 * Format an ISO date string (YYYY-MM-DD) into display format (DD/MM/YYYY).
 * 
 * @param dateStr - ISO date string
 * @returns Formatted date string or empty string if invalid
 */
export function formatDateForDisplay(dateStr: string | null | undefined): string {
    if (!dateStr) return ''

    // 1. If it's already YYYY-MM-DD or YYYY-DD-MM, parse manually to avoid any Date object issues
    const isoMatch = dateStr.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
    if (isoMatch) {
        const [, yyyy, v1, v2] = isoMatch;
        const part1 = parseInt(v1!);
        const part2 = parseInt(v2!);

        if (part1 > 12) {
            // YYYY-DD-MM -> DD/MM/YYYY
            return `${part1.toString().padStart(2, '0')}/${part2.toString().padStart(2, '0')}/${yyyy!}`;
        } else {
            // YYYY-MM-DD -> DD/MM/YYYY
            return `${part2.toString().padStart(2, '0')}/${part1.toString().padStart(2, '0')}/${yyyy!}`;
        }
    }

    // 2. If it's a full ISO string (with T or Z), use UTC methods
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ''

    // If the input string doesn't contain time info, it might be interpreted as midnight local
    // by some browsers. For safety, we use UTC methods if it looks like an ISO string.
    const d = date.getUTCDate().toString().padStart(2, '0')
    const m = (date.getUTCMonth() + 1).toString().padStart(2, '0')
    const y = date.getUTCFullYear()

    return `${d}/${m}/${y}`
}
