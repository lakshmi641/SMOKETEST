/**
 * Central Date Utilities
 * 
 * Enforces DD/MM/YYYY format across the application and handles
 * timezone-neutral parsing and formatting.
 */

import { format } from 'date-fns';
import { formatDateForDisplay as parserFormatDate, parseDate } from './excel/date-parser';

export { parseDate };

/**
 * Format any date value into a user-friendly format with time.
 * e.g., "24 Jan 2026, 11:32 PM"
 */
export function formatFriendlyDate(date: string | Date | number | null | undefined): string {
    if (!date) return '-';

    try {
        let d: Date;
        if (typeof date === 'string') {
            const parsed = new Date(date);
            d = isNaN(parsed.getTime()) ? (getUTCNormalizedDate(date) || new Date(0)) : parsed;
        } else if (date instanceof Date) {
            d = date;
        } else if (typeof (date as any).toDate === 'function') {
            d = (date as any).toDate();
        } else if (typeof (date as any).seconds === 'number') {
            d = new Date((date as any).seconds * 1000);
        } else {
            d = new Date(date);
        }

        if (isNaN(d.getTime())) return '-';

        return format(d, 'dd MMM yyyy, h:mm a');
    } catch (e) {
        console.error('[date-utils] Error formatting friendly date:', e, date);
        return '-';
    }
}

/**
 * Format any date value into a user-friendly format (date only).
 * e.g., "24 Jan 2026"
 */
export function formatFriendlyDateOnly(date: string | Date | number | null | undefined): string {
    if (!date) return '-';

    try {
        let d: Date;
        if (typeof date === 'string') {
            const parsed = new Date(date);
            d = isNaN(parsed.getTime()) ? (getUTCNormalizedDate(date) || new Date(0)) : parsed;
        } else if (date instanceof Date) {
            d = date;
        } else if (typeof (date as any).toDate === 'function') {
            d = (date as any).toDate();
        } else if (typeof (date as any).seconds === 'number') {
            d = new Date((date as any).seconds * 1000);
        } else {
            d = new Date(date);
        }

        if (isNaN(d.getTime())) return '-';

        return format(d, 'dd MMM yyyy');
    } catch (e) {
        console.error('[date-utils] Error formatting friendly date only:', e, date);
        return '-';
    }
}

/**
 * Format any date value into DD/MM/YYYY.
 * 
 * Supports:
 * - ISO date strings (2026-05-02)
 * - Full ISO strings (2026-05-02T00:00:00Z)
 * - Date objects
 * - Timestamps (number)
 * 
 * @param date - The date value to format
 * @returns Formatted string (DD/MM/YYYY)
 */
export function formatDate(date: string | Date | number | null | undefined): string {
    if (!date) return '-';

    try {
        if (typeof date === 'string') {
            const parsed = parserFormatDate(date);
            return parsed && parsed !== 'Invalid Date' ? parsed : '-';
        }

        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) {
            // Check if it's a Firestore Timestamp-like object
            const normalized = getUTCNormalizedDate(date);
            if (normalized) return formatDate(normalized);
            return '-';
        }

        const day = d.getUTCDate().toString().padStart(2, '0');
        const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
        const year = d.getUTCFullYear();

        return `${day}/${month}/${year}`;
    } catch (e) {
        console.error('[date-utils] Error formatting date:', e, date);
        return '-';
    }
}

/**
 * Alternative formatter for values that definitely contain time (like createdAt)
 * where local time might be preferred.
 */
export function formatDateTime(date: string | Date | number | null | undefined): string {
    if (!date) return '-';
    try {
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) {
            const normalized = getUTCNormalizedDate(date);
            if (normalized) return formatDateTime(normalized);
            return '-';
        }

        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');

        return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (e) {
        return '-';
    }
}

/**
 * Normalizes a date value to a Date object at 00:00:00 UTC.
 * Essential for calendar calculations to avoid timezone shifts.
 */
export function getUTCNormalizedDate(date: any): Date | null {
    if (!date) return null;

    try {
        if (date instanceof Date) {
            return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        }

        // Handle Firestore Timestamps or objects with toDate()
        if (date && typeof date.toDate === 'function') {
            const d = date.toDate();
            return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        }

        // Handle raw Firestore-like timestamp objects {seconds, nanoseconds}
        if (date && typeof date.seconds === 'number') {
            const d = new Date(date.seconds * 1000);
            return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        }

        if (typeof date === 'number') {
            const d = new Date(date);
            return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        }

        if (typeof date === 'string') {
            const isoString = parseDate(date);
            if (!isoString) return null;

            const [year, month, day] = isoString.split('-').map(Number);
            if (year === undefined || month === undefined || day === undefined) return null;
            return new Date(Date.UTC(year, month - 1, day));
        }
    } catch (e) {
        console.error('[date-utils] Error normalizing date:', e, date);
    }

    return null;
}

/**
 * Format date to YYYY-MM-DD in a timezone-neutral way (using UTC).
 * 
 * @param date - The date value to format
 * @returns YYYY-MM-DD string
 */
export function formatISODate(date: string | Date | number | null | undefined): string {
    const d = getUTCNormalizedDate(date);
    if (!d || isNaN(d.getTime())) return '';
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
