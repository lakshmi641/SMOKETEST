
const { parse, isValid, format } = require('date-fns');

// Mock formatISODate function from date-parser.ts
function formatISODate(year, month, day) {
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    const yyyy = year.toString();
    const mm = month.toString().padStart(2, '0');
    const dd = day.toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// Mock parseDate from date-parser.ts (simplified to testing relevant path)
function parseDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const trimmed = dateStr.trim();

    const commonFormats = [
        'd MMM yyyy',
        'MMM d, yyyy',
        'MMMM d, yyyy',
        'd MMMM yyyy',
        'yyyy-MM-dd',
        'dd-MM-yyyy',
        'MM-dd-yyyy'
    ];

    for (const fmt of commonFormats) {
        try {
            const parsed = parse(trimmed, fmt, new Date());
            if (isValid(parsed)) {
                console.log(`Matched format: ${fmt} for ${trimmed}`);
                return format(parsed, 'yyyy-MM-dd');
            }
        } catch (e) { }
    }

    const jsDate = new Date(trimmed);
    if (!isNaN(jsDate.getTime())) {
        console.log(`Matched JS Date for ${trimmed}`);
        return formatISODate(jsDate.getFullYear(), jsDate.getMonth() + 1, jsDate.getDate());
    }

    return null;
}

// Test cases from the issue
const validDate = "Feb 7, 2026";
const invalidDate = "Jan 29, 2026";
const anotherInvalid = "Jan 29, 2026"; // from rows 3 and 4

console.log(`Parsing "${validDate}":`, parseDate(validDate));
console.log(`Parsing "${invalidDate}":`, parseDate(invalidDate));
