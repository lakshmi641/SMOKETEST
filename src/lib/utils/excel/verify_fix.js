const { parseDate } = require('./apps/pms/src/lib/utils/excel/date-parser');

// Simulate the logic in ImportExecutionService
function transformRowToPayload(row) {
    const { data, resolvedData } = row;

    // Logic from the fix: prioritize resolvedData
    const dueDate = resolvedData.dueDate || parseExcelDate(data['Due Date'] || data['dueDate']);
    const startDate = resolvedData.startDate || parseExcelDate(data['Start Date'] || data['startDate']);

    return { startDate, dueDate };
}

function parseExcelDate(value) {
    if (!value) return null;
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) return value;

    const normalized = parseDate(String(value));
    if (normalized) return normalized;

    try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0] || null;
        }
    } catch (e) { }
    return null;
}

// Mocking the flow for 5/2/2026
const rawValue = "5/2/2026";

// Case 1: Normalized by PreValidation/SpecificValidation (Feb 5)
const row1 = {
    data: { "Due Date": rawValue },
    resolvedData: { dueDate: "2026-02-05" }
};
const payload1 = transformRowToPayload(row1);
console.log('Case 1 (Normalized):', payload1.dueDate); // Expect 2026-02-05

// Case 2: Not normalized by earlier stages (fallback to parseExcelDate)
const row2 = {
    data: { "Due Date": rawValue },
    resolvedData: {}
};
const payload2 = transformRowToPayload(row2);
console.log('Case 2 (Fallback):', payload2.dueDate); // Expect 2026-02-05 (because parseDate defaults to DD/MM)

// Case 3: Ambiguous date that should be May 2nd if detected so (hinting)
// (Not easily testable here without the full detectDateFormat flow, but parseDate handles it)
