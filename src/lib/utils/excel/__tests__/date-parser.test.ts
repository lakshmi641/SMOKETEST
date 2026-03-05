/**
 * Date Parser Unit Tests
 * 
 * Tests for date parsing utilities including multi-format support
 * and Excel serial date conversion.
 */

import {
    parseDate,
    parseExcelSerial,
    detectDateFormat,
    isValidDate,
    compareDates,
    formatDateForDisplay,
} from '../date-parser'

describe('parseDate', () => {
    describe('ISO format (YYYY-MM-DD)', () => {
        test('parses standard ISO date', () => {
            expect(parseDate('2024-12-15')).toBe('2024-12-15')
        })

        test('parses ISO with single digit month/day', () => {
            expect(parseDate('2024-1-5')).toBe('2024-01-05')
        })

        test('parses ISO with slashes', () => {
            expect(parseDate('2024/12/15')).toBe('2024-12-15')
        })
    })

    describe('DD/MM/YYYY format', () => {
        test('parses standard DD/MM/YYYY', () => {
            expect(parseDate('15/12/2024')).toBe('2024-12-15')
        })

        test('parses with single digit day/month', () => {
            expect(parseDate('5/1/2024')).toBe('2024-01-05')
        })

        test('detects DD/MM when day > 12', () => {
            expect(parseDate('25/06/2024')).toBe('2024-06-25')
        })
    })

    describe('MM/DD/YYYY format', () => {
        test('detects MM/DD when month position has value > 12', () => {
            // If second number > 12, it must be day
            expect(parseDate('06/25/2024')).toBe('2024-06-25')
        })
    })

    describe('YYYY-DD-MM format (Reported Issue)', () => {
        test('parses reported format 2026-29-01', () => {
            expect(parseDate('2026-29-01')).toBe('2026-01-29')
        })

        test('parses YYYY/DD/MM with slashes', () => {
            expect(parseDate('2026/29/01')).toBe('2026-01-29')
        })
    })

    describe('Word-based formats', () => {
        test('parses DD MMM YYYY', () => {
            expect(parseDate('29 Jan 2026')).toBe('2026-01-29')
        })

        test('parses MMM D, YYYY', () => {
            expect(parseDate('Jan 29, 2026')).toBe('2026-01-29')
        })

        test('parses full month name MMMM D, YYYY', () => {
            expect(parseDate('January 29, 2026')).toBe('2026-01-29')
        })

        test('parses DD MMMM YYYY', () => {
            expect(parseDate('29 January 2026')).toBe('2026-01-29')
        })

        test('parses hyphenated month names', () => {
            expect(parseDate('29-Jan-2026')).toBe('2026-01-29')
        })
    })

    describe('Ambiguity resolution', () => {
        test('defaults to ISO for ambiguous YYYY-MM-DD', () => {
            // 2026-01-02 -> Jan 2nd (ISO) or Feb 1st (YDM)?
            // Should default to ISO
            expect(parseDate('2026-01-02')).toBe('2026-01-02')
        })

        test('defaults to DMY for ambiguous DD/MM/YYYY', () => {
            // 01/02/2026 -> Jan 2nd (MDY) or Feb 1st (DMY)?
            // Should default to DMY
            expect(parseDate('01/02/2026')).toBe('2026-02-01')
        })
    })

    describe('Edge cases', () => {
        test('returns null for null input', () => {
            expect(parseDate(null)).toBeNull()
        })

        test('returns null for undefined input', () => {
            expect(parseDate(undefined)).toBeNull()
        })

        test('returns null for empty string', () => {
            expect(parseDate('')).toBeNull()
        })

        test('returns null for whitespace only', () => {
            expect(parseDate('   ')).toBeNull()
        })

        test('returns null for invalid date string', () => {
            expect(parseDate('not-a-date')).toBeNull()
        })

        test('returns null for invalid date like Feb 30', () => {
            expect(parseDate('2024-02-30')).toBeNull()
        })

        test('trims whitespace', () => {
            expect(parseDate('  2024-12-15  ')).toBe('2024-12-15')
        })
    })

    describe('User-reported ambiguous dates', () => {
        test('parses 29/01/2026 correctly as Jan 29', () => {
            expect(parseDate('29/01/2026')).toBe('2026-01-29')
        })

        test('parses 1/2/2026 correctly as Feb 1st (defaulting to DMY)', () => {
            expect(parseDate('1/2/2026')).toBe('2026-02-01')
        })

        test('parses 5/2/2026 correctly as Feb 5th (defaulting to DMY)', () => {
            expect(parseDate('5/2/2026')).toBe('2026-02-05')
        })

        test('parses 31/01/2026 correctly as Jan 31', () => {
            expect(parseDate('31/01/2026')).toBe('2026-01-31')
        })
    })
})

describe('parseExcelSerial', () => {
    test('parses valid Excel serial date', () => {
        // 45641 is approximately 2024-12-15
        const result = parseExcelSerial(45641)
        expect(result).toMatch(/^2024-12/)
    })

    test('returns null for NaN', () => {
        expect(parseExcelSerial(NaN)).toBeNull()
    })

    test('returns null for zero', () => {
        expect(parseExcelSerial(0)).toBeNull()
    })

    test('returns null for negative', () => {
        expect(parseExcelSerial(-1)).toBeNull()
    })
})

describe('detectDateFormat', () => {
    test('detects ISO format', () => {
        const samples = ['2024-12-15', '2024-01-20', '2023-06-10']
        expect(detectDateFormat(samples)).toBe('ISO')
    })

    test('detects DMY_SLASH format', () => {
        const samples = ['15/12/2024', '20/01/2024', '25/06/2023']
        expect(detectDateFormat(samples)).toBe('DMY_SLASH')
    })

    test('detects EXCEL format', () => {
        const samples = ['45641', '45642', '45643']
        expect(detectDateFormat(samples)).toBe('EXCEL')
    })

    test('returns null for empty array', () => {
        expect(detectDateFormat([])).toBeNull()
    })

    test('returns null for array with only empty strings', () => {
        expect(detectDateFormat(['', '', ''])).toBeNull()
    })
})

describe('isValidDate', () => {
    test('returns true for valid ISO date', () => {
        expect(isValidDate('2024-12-15')).toBe(true)
    })

    test('returns false for null', () => {
        expect(isValidDate(null)).toBe(false)
    })

    test('returns false for invalid string', () => {
        expect(isValidDate('invalid')).toBe(false)
    })

    test('returns false for date before 1900', () => {
        expect(isValidDate('1800-01-01')).toBe(false)
    })

    test('returns false for date after 2100', () => {
        expect(isValidDate('2200-01-01')).toBe(false)
    })
})

describe('compareDates', () => {
    test('returns -1 when first date is earlier', () => {
        expect(compareDates('2024-01-01', '2024-12-31')).toBe(-1)
    })

    test('returns 1 when first date is later', () => {
        expect(compareDates('2024-12-31', '2024-01-01')).toBe(1)
    })

    test('returns 0 when dates are equal', () => {
        expect(compareDates('2024-06-15', '2024-06-15')).toBe(0)
    })
})

describe('formatDateForDisplay', () => {
    test('formats ISO date to DD/MM/YYYY', () => {
        expect(formatDateForDisplay('2024-12-15')).toBe('15/12/2024')
    })

    test('formats single digit month/day with leading zeros', () => {
        expect(formatDateForDisplay('2024-01-05')).toBe('05/01/2024')
    })

    test('returns empty string for null/undefined', () => {
        expect(formatDateForDisplay(null as any)).toBe('')
        expect(formatDateForDisplay(undefined as any)).toBe('')
    })

    test('returns empty string for invalid date', () => {
        expect(formatDateForDisplay('invalid')).toBe('')
    })
})
