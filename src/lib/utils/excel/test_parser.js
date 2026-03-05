const { parseDate } = require('./apps/pms/src/lib/utils/excel/date-parser');

async function test() {
    console.log('Testing parseDate("5/2/2026"):');
    console.log('Result:', parseDate('5/2/2026'));

    console.log('\nTesting parseDate("05/02/2026"):');
    console.log('Result:', parseDate('05/02/2026'));

    console.log('\nTesting parseDate("2/5/2026"):');
    console.log('Result:', parseDate('2/5/2026'));

    console.log('\nTesting parseDate("29/1/2026"):');
    console.log('Result:', parseDate('29/1/2026'));

    console.log('\nTesting parseDate("5/2/2026", "MDY_SLASH"):');
    console.log('Result:', parseDate('5/2/2026', 'MDY_SLASH'));
}

// Map required functions for Node environment if necessary
// (Since date-parser.ts is TypeScript, I might need to run it with ts-node or just use the logic)

// Actually, I'll just write the logic here to verify my understanding.
function formatISODate(year, month, day) {
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    const yyyy = year.toString();
    const mm = month.toString().padStart(2, '0');
    const dd = day.toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

const DATE_PATTERNS = {
    DMY: /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/,
};

function mockParseDate(dateStr) {
    const trimmed = dateStr.trim();
    const dmyMatch = trimmed.match(DATE_PATTERNS.DMY);
    if (dmyMatch) {
        const v1 = parseInt(dmyMatch[1]);
        const v2 = parseInt(dmyMatch[2]);
        const year = parseInt(dmyMatch[3]);

        if (v1 > 12) return formatISODate(year, v2, v1);
        if (v2 > 12) return formatISODate(year, v1, v2);

        // Default: Treat as DD/MM/YYYY
        return formatISODate(year, v2, v1); // v2 is Month, v1 is Day
    }
}

console.log('Mock test "5/2/2026" (Ambiguous):');
console.log('Result:', mockParseDate('5/2/2026')); // Should be Feb 5

console.log('\nMock test "13/2/2026" (v1 > 12):');
console.log('Result:', mockParseDate('13/2/2026')); // Should be Feb 13

console.log('\nMock test "2/13/2026" (v2 > 12):');
console.log('Result:', mockParseDate('2/13/2026')); // Should be Feb 13
