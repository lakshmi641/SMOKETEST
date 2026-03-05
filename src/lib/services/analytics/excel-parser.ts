import { read, utils, SSF } from 'xlsx';
import { SalesTransaction } from './sales-schema';

/**
 * Excel Parser Service
 * 
 * Parses Excel files and converts them to sales transaction format.
 * Handles various Excel formats and column mappings.
 */

export interface ExcelParseResult {
  transactions: SalesTransaction[];
  errors: string[];
  totalRows: number;
  parsedRows: number;
}

/**
 * Common column name mappings for sales data
 */
const COLUMN_MAPPINGS: Record<string, keyof SalesTransaction> = {
  // Date columns
  'date': 'transaction_date',
  'transaction date': 'transaction_date',
  'sale date': 'transaction_date',
  'invoice date': 'transaction_date',
  'transaction_date': 'transaction_date',
  
  // Invoice
  'invoice': 'invoice_number',
  'invoice number': 'invoice_number',
  'invoice no': 'invoice_number',
  'invoice_number': 'invoice_number',
  'bill no': 'invoice_number',
  'bill number': 'invoice_number',
  
  // Customer
  'customer': 'customer_name',
  'customer name': 'customer_name',
  'customer_name': 'customer_name',
  'client': 'customer_name',
  'client name': 'customer_name',
  'party': 'customer_name',
  'party name': 'customer_name',
  'customer code': 'customer_code',
  'customer_code': 'customer_code',
  'client code': 'customer_code',
  
  // Product
  'product': 'product_name',
  'product name': 'product_name',
  'product_name': 'product_name',
  'item': 'product_name',
  'item name': 'product_name',
  'description': 'product_name',
  'product code': 'product_code',
  'product_code': 'product_code',
  'item code': 'product_code',
  'sku': 'product_code',
  
  // Quantity
  'quantity': 'quantity',
  'qty': 'quantity',
  'qty.': 'quantity',
  
  // Price
  'price': 'unit_price',
  'unit price': 'unit_price',
  'unit_price': 'unit_price',
  'rate': 'unit_price',
  
  // Amount - more variations
  'amount': 'total_amount',
  'total': 'total_amount',
  'total amount': 'total_amount',
  'total_amount': 'total_amount',
  'value': 'total_amount',
  'sales amount': 'total_amount',
  'amt': 'total_amount',
  'amt.': 'total_amount',
  'grand total': 'total_amount',
  'grandtotal': 'total_amount',
  'net amount': 'total_amount',
  'netamount': 'total_amount',
  'bill amount': 'total_amount',
  'billamount': 'total_amount',
  'invoice amount': 'total_amount',
  'invoiceamount': 'total_amount',
  'sale amount': 'total_amount',
  'saleamount': 'total_amount',
  'sales value': 'total_amount',
  'salesvalue': 'total_amount',
  
  // Tax
  'tax': 'tax_amount',
  'tax amount': 'tax_amount',
  'tax_amount': 'tax_amount',
  'gst': 'tax_amount',
  'vat': 'tax_amount',
  
  // Discount
  'discount': 'discount_amount',
  'discount amount': 'discount_amount',
  'discount_amount': 'discount_amount',
  
  // Payment
  'payment method': 'payment_method',
  'payment_method': 'payment_method',
  'payment': 'payment_method',
  'mode of payment': 'payment_method',
  
  // Sales person
  'sales person': 'sales_person',
  'sales_person': 'sales_person',
  'salesperson': 'sales_person',
  'sales rep': 'sales_person',
  'sales representative': 'sales_person',
  
  // Region
  'region': 'region',
  'area': 'region',
  'territory': 'region',
  
  // Category
  'category': 'category',
  'product category': 'category',
  
  // Notes
  'notes': 'notes',
  'note': 'notes',
  'remarks': 'notes',
};

/**
 * Normalize column name for matching
 */
function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim().replace(/[_\s]+/g, ' ');
}

/**
 * Parse Excel file to sales transactions
 * Works in both browser and server-side (Node.js) environments
 */
export async function parseExcelToSalesTransactions(
  file: File | ArrayBuffer | Buffer,
  companyId: string,
  userId?: string,
  sourceFileName?: string
): Promise<ExcelParseResult> {
  try {
    let data: ArrayBuffer | Buffer;
    
    // Handle different input types
    if (file instanceof File) {
      // In server-side (Next.js API routes), File has arrayBuffer() method
      data = await file.arrayBuffer();
    } else if (file instanceof Buffer) {
      // Already a Buffer (Node.js)
      data = file;
    } else {
      // Already an ArrayBuffer
      data = file;
    }
    
    // Read workbook from buffer/array
    const workbook = read(data, { type: 'array' });
    
    // Get first sheet
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return {
        transactions: [],
        errors: ['Excel file has no sheets'],
        totalRows: 0,
        parsedRows: 0,
      };
    }
    
    console.log('Available sheets:', workbook.SheetNames);
    console.log('Using sheet:', firstSheetName);
    
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Get the range of the worksheet to see what data exists
    if (!worksheet) {
      throw new Error('Worksheet not found in Excel file');
    }
    const range = utils.decode_range(worksheet['!ref'] || 'A1');
    console.log('Worksheet range:', {
      start: { row: range.s.r, col: range.s.c },
      end: { row: range.e.r, col: range.e.c },
      totalRows: range.e.r + 1,
      totalCols: range.e.c + 1,
    });
    
    // Try to read raw data first to see what we have
    const rawData = utils.sheet_to_json(worksheet, { 
      raw: true, // Get raw values first
      defval: null,
      header: 1, // Get as array of arrays
    });
    
    console.log('Raw data sample (first 5 rows):', rawData.slice(0, 5));
    
    // Now convert to JSON with headers
    const jsonData = utils.sheet_to_json(worksheet, { 
      raw: false, // Get values as strings for better parsing
      defval: null,
      blankrows: false, // Skip blank rows
      header: 'A', // Use column letters if no header row
    });
    
    console.log('JSON data length:', jsonData.length);
    console.log('First row keys:', jsonData.length > 0 ? Object.keys(jsonData[0] || {}) : 'No data');
    
    // If we got column letters (A, B, C, etc.), try to find header row
    let processedData = jsonData;
    if (jsonData.length > 0 && Object.keys(jsonData[0] || {}).some(key => /^[A-Z]+$/.test(key))) {
      console.log('Detected column letters, trying to find header row...');
      // Try reading with first row as header
      const withHeaders = utils.sheet_to_json(worksheet, {
        raw: false,
        defval: null,
        blankrows: false,
        range: 1, // Skip first row, use second as header
      });
      if (withHeaders.length > 0) {
        processedData = withHeaders;
        console.log('Using second row as header, found', processedData.length, 'rows');
      }
    }
    
    // Filter out completely empty rows
    processedData = processedData.filter((row: any) => {
      // Check if row has any non-null, non-empty values
      const hasData = Object.values(row).some((val: any) => {
        if (val === null || val === undefined) return false;
        if (typeof val === 'string' && val.trim() === '') return false;
        return true;
      });
      return hasData;
    });
    
    console.log('Processed data length after filtering:', processedData.length);
    
    if (processedData.length === 0) {
      // Try alternative parsing methods
      console.log('No data found, trying alternative parsing...');
      
      // Try reading all rows as arrays
      const allRows = utils.sheet_to_json(worksheet, { header: 1, defval: null });
      console.log('All rows as arrays:', allRows.length, 'rows');
      console.log('First 10 rows:', allRows.slice(0, 10));
      
      if (allRows.length > 1) {
        // Try to use first row as headers
        const headers = allRows[0] as string[];
        const dataRows = allRows.slice(1) as any[][];
        
        processedData = dataRows
          .filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''))
          .map(row => {
            const obj: any = {};
            headers.forEach((header, index) => {
              if (header) {
                obj[String(header).trim()] = row[index];
              }
            });
            return obj;
          });
        
        console.log('Converted from arrays, found', processedData.length, 'rows');
      }
      
      if (processedData.length === 0) {
        return {
          transactions: [],
          errors: [
            'Excel file appears to be empty or has no readable data',
            `Found ${allRows.length} total rows in file`,
            'Please ensure the file has data rows with at least Date and Amount columns',
          ],
          totalRows: allRows.length,
          parsedRows: 0,
        };
      }
    }
    
    // Get headers from first row
    const headers = Object.keys(processedData[0] || {});
    const columnMap: Record<string, keyof SalesTransaction> = {};
    
    // Debug: Log headers found
    console.log('Excel headers found:', headers);
    
    // Map columns
    headers.forEach((header) => {
      const normalized = normalizeColumnName(header);
      const mappedKey = COLUMN_MAPPINGS[normalized];
      if (mappedKey) {
        columnMap[header] = mappedKey;
        console.log(`Mapped column "${header}" -> "${mappedKey}"`);
      }
    });
    
    // Debug: Log column mapping
    console.log('Column mapping:', columnMap);
    
    // If no columns were mapped, try to auto-detect common patterns
    if (Object.keys(columnMap).length === 0) {
      console.log('No columns mapped, attempting auto-detection...');
      headers.forEach((header) => {
        const normalized = normalizeColumnName(header);
        // Try to find date-like columns
        if (normalized.includes('date') || normalized.includes('dt')) {
          columnMap[header] = 'transaction_date';
        }
        // Try to find amount-like columns (more flexible matching)
        if (
          normalized.includes('amount') || 
          normalized.includes('total') || 
          normalized.includes('value') || 
          normalized.includes('amt') ||
          normalized.includes('bill') ||
          normalized.includes('invoice') ||
          normalized.includes('sale') ||
          normalized === 'amt' ||
          normalized === 'total'
        ) {
          // Only map if not already mapped to something else
          if (!columnMap[header]) {
            columnMap[header] = 'total_amount';
          }
        }
        // Try to find invoice columns
        if (normalized.includes('invoice') || normalized.includes('bill') || normalized.includes('inv')) {
          columnMap[header] = 'invoice_number';
        }
        // Try to find customer columns
        if (normalized.includes('customer') || normalized.includes('client') || normalized.includes('party')) {
          columnMap[header] = 'customer_name';
        }
        // Try to find product columns
        if (normalized.includes('product') || normalized.includes('item') || normalized.includes('description')) {
          columnMap[header] = 'product_name';
        }
      });
      console.log('Auto-detected column mapping:', columnMap);
    }
    
    // Parse rows
    const transactions: SalesTransaction[] = [];
    const errors: string[] = [];
    const now = new Date().toISOString();
    
    processedData.forEach((row: any, index: number) => {
      try {
        // Debug first few rows
        if (index < 3) {
          console.log(`Row ${index + 2} data:`, row);
        }
        
        const transaction = parseRowToTransaction(
          row,
          columnMap,
          companyId,
          userId,
          sourceFileName,
          now
        );
        
        if (transaction) {
          transactions.push(transaction);
        } else {
          // More detailed error message
          const hasDate = Object.values(columnMap).includes('transaction_date');
          const hasAmount = Object.values(columnMap).includes('total_amount');
          const dateValue = Object.entries(columnMap)
            .find(([_, key]) => key === 'transaction_date')?.[0]
            ? row[Object.entries(columnMap).find(([_, key]) => key === 'transaction_date')?.[0] || '']
            : null;
          const amountValue = Object.entries(columnMap)
            .find(([_, key]) => key === 'total_amount')?.[0]
            ? row[Object.entries(columnMap).find(([_, key]) => key === 'total_amount')?.[0] || '']
            : null;
          
          errors.push(
            `Row ${index + 2}: Missing required fields. ` +
            `Date column: ${hasDate ? 'found' : 'not found'} (value: ${dateValue}), ` +
            `Amount column: ${hasAmount ? 'found' : 'not found'} (value: ${amountValue})`
          );
        }
      } catch (error) {
        errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Parse error'}`);
      }
    });
    
    return {
      transactions,
      errors,
      totalRows: processedData.length,
      parsedRows: transactions.length,
    };
  } catch (error) {
    throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse a single row to SalesTransaction
 */
function parseRowToTransaction(
  row: any,
  columnMap: Record<string, keyof SalesTransaction>,
  companyId: string,
  userId?: string,
  sourceFileName?: string,
  timestamp?: string
): SalesTransaction | null {
  const transaction: Partial<SalesTransaction> = {
    company_id: companyId,
    created_at: timestamp || new Date().toISOString(),
    updated_at: timestamp || new Date().toISOString(),
    uploaded_by: userId,
    source_file: sourceFileName,
  };
  
  // Map columns
  Object.entries(columnMap).forEach(([excelColumn, transactionKey]) => {
    const value = row[excelColumn];
    if (value !== null && value !== undefined && value !== '') {
      const parsedValue = parseValue(value, transactionKey);
      if (parsedValue !== null && parsedValue !== undefined) {
        transaction[transactionKey] = parsedValue;
      }
    }
  });
  
  // Debug: Log what we found
  if (!transaction.transaction_date || !transaction.total_amount) {
    console.log('Transaction validation failed:', {
      hasDate: !!transaction.transaction_date,
      dateValue: transaction.transaction_date,
      hasAmount: !!transaction.total_amount,
      amountValue: transaction.total_amount,
      rowKeys: Object.keys(row),
      columnMap,
    });
  }
  
  // Validate required fields - date must be present
  if (!transaction.transaction_date) {
    return null;
  }
  
  // If amount is not found, try to calculate from quantity * unit_price
  if (!transaction.total_amount || transaction.total_amount === 0) {
    if (transaction.quantity && transaction.unit_price) {
      transaction.total_amount = transaction.quantity * transaction.unit_price;
      console.log(`Calculated amount from quantity * price: ${transaction.total_amount}`);
    } else {
      // Default to 0 if amount cannot be determined
      transaction.total_amount = 0;
      console.log('Amount not found and cannot be calculated, defaulting to 0');
    }
  }
  
  // Allow transactions with 0 amount (might be returns, adjustments, etc.)
  // But log a warning
  if (transaction.total_amount === 0) {
    console.log('Warning: Transaction has 0 amount');
  }
  
  return transaction as SalesTransaction;
}

/**
 * Parse value based on field type
 */
function parseValue(value: any, field: keyof SalesTransaction): any {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // Handle date fields
  if (field === 'transaction_date') {
    return parseDate(value);
  }
  
  // Handle numeric fields
  if (['quantity', 'unit_price', 'total_amount', 'tax_amount', 'discount_amount'].includes(field)) {
    return parseNumber(value);
  }
  
  // Handle string fields
  return String(value).trim() || null;
}

/**
 * Parse date value
 */
function parseDate(value: any): string | null {
  if (!value) return null;
  
  // If it's already a Date object
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) {
      return formatDate(value);
    }
    return null;
  }
  
  // If it's a number (Excel date serial number)
  if (typeof value === 'number') {
    try {
      // Use SSF to parse Excel date code
      const date = SSF.parse_date_code(value);
      if (date && date.y && date.m && date.d) {
        return formatDate(new Date(date.y, date.m - 1, date.d));
      }
    } catch (e) {
      // Fallback: Excel date serial: days since 1900-01-00
      // Excel epoch is actually 1899-12-30 (not 1900-01-01)
      const excelEpoch = new Date(1899, 11, 30);
      const jsDate = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
      if (!isNaN(jsDate.getTime()) && jsDate.getFullYear() > 1900 && jsDate.getFullYear() < 2100) {
        return formatDate(jsDate);
      }
    }
  }
  
  // Try parsing as string
  const dateStr = String(value).trim();
  if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return null;
  
  // Try ISO format first
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return formatDate(date);
    }
  }
  
  // Try DD/MM/YYYY or DD-MM-YYYY (common Indian format)
  const parts = dateStr.split(/[-\/\.]/);
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    
    // Handle 2-digit years
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }
    
    if (!isNaN(day) && !isNaN(month) && !isNaN(year) && day > 0 && day < 32 && month >= 0 && month < 12) {
      const parsedDate = new Date(year, month, day);
      if (!isNaN(parsedDate.getTime())) {
        return formatDate(parsedDate);
      }
    }
  }
  
  // Try standard Date parsing
  const date = new Date(dateStr);
  if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
    return formatDate(date);
  }
  
  return null;
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse number value
 */
function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  
  // Remove currency symbols and commas
  const cleaned = String(value)
    .replace(/[₹$€£,]/g, '')
    .replace(/\s+/g, '')
    .trim();
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

