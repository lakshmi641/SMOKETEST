import * as XLSX from 'xlsx';

/**
 * File Validation Service
 * 
 * Validates file formats and field mappings against staging table schemas.
 * 
 * ⚠️ SERVER-ONLY: This service uses Node.js built-in modules and should only be used in:
 * - API Routes (/app/api/*)
 * - Server Components (default in App Router)
 * - Server Actions
 * - Middleware
 * 
 * Do NOT import this in Client Components (files with 'use client' directive).
 */

export type FileType = 'sales' | 'item' | 'account' | 'customer_type' | 'industry_type' | 'region' | 'sale_type' | 'model';

export interface FieldMapping {
  fileColumn: string;
  stagingColumn: string;
  required: boolean;
  status: 'mapped' | 'unmapped' | 'warning';
  reason?: string;
}

export interface ValidationResult {
  isValid: boolean;
  fileFormat: string;
  supportedFormat: boolean;
  targetTable: string;
  mappedFields: FieldMapping[];
  unmappedFields: Array<{ fileColumn: string; reason: string }>;
  missingRequiredFields: Array<{ stagingColumn: string; reason: string }>;
  warnings: string[];
  errors: string[];
}

// Staging table schemas
const STAGING_SCHEMAS: Record<string, { columns: string[]; required: string[] }> = {
  'staging.staging_sales_book': {
    columns: [
      'Invoice Date',
      'Voucher',
      'Item Code',
      'Item Name',
      'Customer Account Code',
      'Customer Account Name',
      'Business Types',
      'Industry Type Name',
      'Region Name',
      'Sale Type Name',
      'Model Name',
      'Serial No / Chasis No.',
      'Quantity',
      'Rate',
      'Gross',
      'Taxable Value',
      'CGST',
      'SGST',
      'IGST',
    ],
    required: [], // All fields are nullable in staging
  },
  'staging.staging_item': {
    columns: ['sCode', 'sName', 'iProductType', 'HSNSAC', 'iParentId'],
    required: [],
  },
  'staging.staging_account': {
    columns: ['sCode', 'sName', 'iAccountType', 'fCreditLimit', 'iParentId', 'ParentName'],
    required: [],
  },
  'staging.staging_customer_type': {
    columns: ['sCode', 'sName'],
    required: [],
  },
  'staging.staging_industry_type': {
    columns: ['sCode', 'sName'],
    required: [],
  },
  'staging.staging_region': {
    columns: ['sCode', 'sName'],
    required: [],
  },
  'staging.staging_sale_type': {
    columns: ['sCode', 'sName'],
    required: [],
  },
  'staging.staging_model': {
    columns: ['sCode', 'sName', 'iParentId', 'ParentName'],
    required: [],
  },
};

// Column mapping for sales files (from sales-ingestion-service.ts)
const SALES_COLUMN_MAPPING: Record<string, string> = {
  'Invoice Date': 'Invoice Date',
  'Voucher': 'Voucher',
  'Voucher No': 'Voucher',
  'Invoice No': 'Voucher',
  'Item Code': 'Item Code',
  'Item HSN/SAC': 'Item Code',
  'Item Name': 'Item Name',
  'Product Name': 'Item Name',
  'Customer Account Code': 'Customer Account Code',
  'Customer Account Bu': 'Customer Account Code',
  'Customer Account Name': 'Customer Account Name',
  'Customer Name': 'Customer Account Name',
  'Business Types': 'Business Types',
  'Industry Type Name': 'Industry Type Name',
  'Region Name': 'Region Name',
  'Place of Supply Name': 'Region Name',
  'Sale Type Name': 'Sale Type Name',
  'Model Name': 'Model Name',
  'Modal Name': 'Model Name',
  'Product Category Name': 'Model Name',
  'Serial No / Chasis No.': 'Serial No / Chasis No.',
  'Serial No': 'Serial No / Chasis No.',
  'Chasis No': 'Serial No / Chasis No.',
  'Quantity': 'Quantity',
  'Rate': 'Rate',
  'Gross': 'Gross',
  'Taxable Value': 'Taxable Value',
  'CGST': 'CGST',
  'SGST': 'SGST',
  'IGST': 'IGST',
};

// Master data column mappings
const MASTER_DATA_COLUMN_MAPPINGS: Record<string, Record<string, string>> = {
  'staging.staging_item': {
    'sCode': 'sCode',
    'Code': 'sCode',
    'sName': 'sName',
    'Name': 'sName',
    'iProductType': 'iProductType',
    'Product Type': 'iProductType',
    'HSNSAC': 'HSNSAC',
    'HSN/SAC': 'HSNSAC',
    'iParentId': 'iParentId',
    'Parent ID': 'iParentId',
  },
  'staging.staging_account': {
    'sCode': 'sCode',
    'Code': 'sCode',
    'sName': 'sName',
    'Name': 'sName',
    'iAccountType': 'iAccountType',
    'Account Type': 'iAccountType',
    'fCreditLimit': 'fCreditLimit',
    'Credit Limit': 'fCreditLimit',
    'iParentId': 'iParentId',
    'Parent ID': 'iParentId',
    'ParentName': 'ParentName',
    'Parent Name': 'ParentName',
  },
};

export class FileValidationService {
  /**
   * Detect file type from filename
   */
  detectFileType(fileName: string): FileType | null {
    const lowerName = fileName.toLowerCase();
    
    if (lowerName.includes('sales') || lowerName.includes('day_book')) {
      return 'sales';
    }
    if (lowerName.includes('item') || /020item/i.test(fileName)) {
      return 'item';
    }
    if (lowerName.includes('account') || /020account/i.test(fileName)) {
      return 'account';
    }
    if (lowerName.includes('customertype') || /020customertype/i.test(fileName)) {
      return 'customer_type';
    }
    if (lowerName.includes('industrytype') || /020industrytype/i.test(fileName)) {
      return 'industry_type';
    }
    if (lowerName.includes('region') || /020region/i.test(fileName)) {
      return 'region';
    }
    if (lowerName.includes('saletype') || /020saletype/i.test(fileName)) {
      return 'sale_type';
    }
    if (lowerName.includes('model') || /020model/i.test(fileName)) {
      return 'model';
    }
    
    return null;
  }

  /**
   * Get target staging table for file type
   */
  getTargetTable(fileType: FileType): string {
    const tableMap: Record<FileType, string> = {
      sales: 'staging.staging_sales_book',
      item: 'staging.staging_item',
      account: 'staging.staging_account',
      customer_type: 'staging.staging_customer_type',
      industry_type: 'staging.staging_industry_type',
      region: 'staging.staging_region',
      sale_type: 'staging.staging_sale_type',
      model: 'staging.staging_model',
    };
    return tableMap[fileType];
  }

  /**
   * Validate file format
   */
  validateFileFormat(file: File | Buffer, fileName: string): {
    isValid: boolean;
    format: string;
    supported: boolean;
    error?: string;
  } {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const supportedFormats = ['xlsx', 'xls', 'csv', 'parquet'];
    const formatMap: Record<string, string> = {
      xlsx: 'Excel (.xlsx)',
      xls: 'Excel (.xls)',
      csv: 'CSV',
      parquet: 'Parquet',
    };

    if (!extension || !supportedFormats.includes(extension)) {
      return {
        isValid: false,
        format: extension || 'unknown',
        supported: false,
        error: `Unsupported file format. Supported formats: ${supportedFormats.join(', ')}`,
      };
    }

    return {
      isValid: true,
      format: formatMap[extension] || extension,
      supported: true,
    };
  }

  /**
   * Read file headers (first row)
   */
  async readFileHeaders(file: File | Buffer, fileName: string): Promise<string[]> {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (extension === 'xlsx' || extension === 'xls') {
      // Read Excel file
      const buffer = file instanceof File ? await file.arrayBuffer() : file;
      const workbook = XLSX.read(buffer, { type: 'buffer', sheetRows: 1 });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('No sheets found in Excel file');
      }
      const firstSheet = workbook.Sheets[firstSheetName];
      if (!firstSheet) {
        throw new Error('First sheet is empty');
      }
      const headers: string[] = [];
      
      // Get first row
      const range = XLSX.utils.decode_range(firstSheet['!ref'] || 'A1');
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        const cell = firstSheet[cellAddress];
        if (cell && cell.v) {
          headers.push(String(cell.v).trim());
        }
      }
      
      return headers.filter((h) => h.length > 0);
    } else if (extension === 'csv') {
      // For CSV, we'd need to read first line
      // This is a simplified version - in production, use a proper CSV parser
      const text = file instanceof File ? await file.text() : file.toString();
      const lines = text.split('\n');
      const firstLine = lines[0];
      if (!firstLine) {
        throw new Error('CSV file is empty');
      }
      return firstLine.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    }
    
    throw new Error(`Cannot read headers from file format: ${extension}`);
  }

  /**
   * Validate field mapping
   */
  async validateFile(
    file: File | Buffer,
    fileName: string,
    fileType?: FileType
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Detect file type if not provided
    const detectedType = fileType || this.detectFileType(fileName);
    if (!detectedType) {
      errors.push('Could not determine file type from filename. Please specify file type.');
      return {
        isValid: false,
        fileFormat: 'unknown',
        supportedFormat: false,
        targetTable: 'unknown',
        mappedFields: [],
        unmappedFields: [],
        missingRequiredFields: [],
        warnings,
        errors,
      };
    }

    // Validate file format
    const formatValidation = this.validateFileFormat(file, fileName);
    if (!formatValidation.isValid) {
      errors.push(formatValidation.error || 'Invalid file format');
      return {
        isValid: false,
        fileFormat: formatValidation.format,
        supportedFormat: formatValidation.supported,
        targetTable: this.getTargetTable(detectedType),
        mappedFields: [],
        unmappedFields: [],
        missingRequiredFields: [],
        warnings,
        errors,
      };
    }

    // Get target table and schema
    const targetTable = this.getTargetTable(detectedType);
    const schema = STAGING_SCHEMAS[targetTable];
    if (!schema) {
      errors.push(`Unknown target table: ${targetTable}`);
      return {
        isValid: false,
        fileFormat: formatValidation.format,
        supportedFormat: formatValidation.supported,
        targetTable,
        mappedFields: [],
        unmappedFields: [],
        missingRequiredFields: [],
        warnings,
        errors,
      };
    }

    // Read file headers
    let fileHeaders: string[] = [];
    try {
      fileHeaders = await this.readFileHeaders(file, fileName);
    } catch (error) {
      errors.push(`Failed to read file headers: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        isValid: false,
        fileFormat: formatValidation.format,
        supportedFormat: formatValidation.supported,
        targetTable,
        mappedFields: [],
        unmappedFields: [],
        missingRequiredFields: [],
        warnings,
        errors,
      };
    }

    if (fileHeaders.length === 0) {
      errors.push('No headers found in file');
      return {
        isValid: false,
        fileFormat: formatValidation.format,
        supportedFormat: formatValidation.supported,
        targetTable,
        mappedFields: [],
        unmappedFields: [],
        missingRequiredFields: [],
        warnings,
        errors,
      };
    }

    // Get column mapping based on file type
    const columnMapping =
      detectedType === 'sales'
        ? SALES_COLUMN_MAPPING
        : MASTER_DATA_COLUMN_MAPPINGS[targetTable] || {};

    // Map fields
    const mappedFields: FieldMapping[] = [];
    const unmappedFields: Array<{ fileColumn: string; reason: string }> = [];
    const mappedStagingColumns = new Set<string>();

    for (const fileHeader of fileHeaders) {
      const normalized = fileHeader.trim();
      
      // Try to find mapping
      let mapped = false;
      let stagingColumn: string | undefined;
      
      // Try exact match
      if (columnMapping[normalized]) {
        stagingColumn = columnMapping[normalized];
        mapped = true;
      } else {
        // Try case-insensitive match
        const lowerNormalized = normalized.toLowerCase();
        for (const [fileCol, stagingCol] of Object.entries(columnMapping)) {
          if (fileCol.toLowerCase() === lowerNormalized) {
            stagingColumn = stagingCol;
            mapped = true;
            break;
          }
        }
      }

      if (mapped && stagingColumn) {
        const isRequired = schema.required.includes(stagingColumn);
        mappedFields.push({
          fileColumn: fileHeader,
          stagingColumn,
          required: isRequired,
          status: 'mapped',
        });
        mappedStagingColumns.add(stagingColumn);
      } else {
        unmappedFields.push({
          fileColumn: fileHeader,
          reason: 'No mapping found for this column',
        });
      }
    }

    // Check for missing required fields
    const missingRequiredFields: Array<{ stagingColumn: string; reason: string }> = [];
    for (const requiredCol of schema.required) {
      if (!mappedStagingColumns.has(requiredCol)) {
        missingRequiredFields.push({
          stagingColumn: requiredCol,
          reason: 'Required field not found in file',
        });
        errors.push(`Required field '${requiredCol}' is missing`);
      }
    }

    // Add warnings for unmapped fields
    if (unmappedFields.length > 0) {
      warnings.push(`${unmappedFields.length} column(s) will not be mapped to staging table`);
    }

    // Determine overall validity
    const isValid = errors.length === 0 && missingRequiredFields.length === 0;

    return {
      isValid,
      fileFormat: formatValidation.format,
      supportedFormat: formatValidation.supported,
      targetTable,
      mappedFields,
      unmappedFields,
      missingRequiredFields,
      warnings,
      errors,
    };
  }
}

// Export singleton instance
export const fileValidationService = new FileValidationService();

