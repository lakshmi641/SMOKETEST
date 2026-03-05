/**
 * Position Import Service
 *
 * Handles bulk import of positions from CSV/Excel files.
 * Supports two import modes:
 * 1. Basic Import - Create new positions without hierarchy
 * 2. Hierarchy Import - Update existing positions with parent references
 */

import * as XLSX from 'xlsx'
import { createPosition, getOrgUnits, getPositions, updatePosition } from './org-services'
import type { Position, OrgUnit, PositionScope, ApprovalAuthority } from '@/types/org-schema'
import { SpellCheckService } from '@/lib/services/import/spell-check-service'

// ============================================================================
// TYPES
// ============================================================================

export type PositionImportMode = 'basic' | 'hierarchy'

export interface CellSuggestion {
  value: string
  label: string
  confidence: number
}

export interface CellValidationMessage {
  field: string
  message: string
  severity: 'error' | 'warning'
  suggestion?: CellSuggestion
}

export interface PositionImportRow {
  rowNumber: number
  title: string
  code: string
  description: string
  designation: string
  orgUnitName: string
  employmentType: string
  status: string
}

// Enhanced row with validation messages for editable review
export interface ValidatedPositionRow {
  rowNumber: number
  data: Record<string, string>
  messages: CellValidationMessage[]
  status: 'success' | 'warning' | 'error'
  resolvedOrgUnitId?: string
}

export interface PositionHierarchyImportRow {
  rowNumber: number
  positionCode: string
  designation?: string
  reportsToCode: string
  positionId?: string
  reportsToPositionId?: string
}

// Enhanced hierarchy row with validation messages
export interface ValidatedHierarchyRow {
  rowNumber: number
  data: Record<string, string>
  messages: CellValidationMessage[]
  status: 'success' | 'warning' | 'error'
  resolvedPositionId?: string
  resolvedReportsToId?: string
}

export interface PositionImportValidationError {
  rowNumber: number
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface PositionImportValidationResult {
  isValid: boolean
  rows: PositionImportRow[]
  errors: PositionImportValidationError[]
  warnings: PositionImportValidationError[]
  summary: {
    totalRows: number
    validRows: number
    errorRows: number
    warningRows: number
  }
}

// Enhanced validation result with editable rows
export interface EnhancedPositionValidationResult {
  validatedRows: ValidatedPositionRow[]
  headers: string[]
  orgUnits: OrgUnit[]
  summary: {
    totalRows: number
    validRows: number
    errorRows: number
    warningRows: number
  }
}

export interface EnhancedHierarchyValidationResult {
  validatedRows: ValidatedHierarchyRow[]
  headers: string[]
  positions: Position[]
  summary: {
    totalRows: number
    validRows: number
    errorRows: number
    warningRows: number
  }
}

export interface PositionImportResult {
  success: number
  failed: number
  errors: Array<{ rowNumber: number; code: string; error: string }>
  createdPositions: Position[]
}

export interface PositionHierarchyValidationResult {
  isValid: boolean
  rows: PositionHierarchyImportRow[]
  errors: PositionImportValidationError[]
  warnings: PositionImportValidationError[]
  summary: {
    totalRows: number
    validRows: number
    errorRows: number
    warningRows: number
  }
}

export interface PositionHierarchyImportResult {
  success: number
  failed: number
  errors: Array<{ rowNumber: number; code: string; error: string }>
  updatedPositions: Position[]
}

// ============================================================================
// SCHEMA
// ============================================================================

export const POSITION_IMPORT_SCHEMA = {
  required: ['Title', 'Code', 'Org Unit'],
  optional: [
    'Description',
    'Designation',
    'Employment Type',
    'Status'
  ]
} as const

export const POSITION_HIERARCHY_SCHEMA = {
  required: ['Position Code', 'Reports To Code'],
  optional: []
} as const

const VALID_EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'temporary'] as const
const VALID_STATUSES = ['active', 'inactive'] as const

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[_\s]+/g, ' ')
}

function normalizeEmploymentType(value: string): typeof VALID_EMPLOYMENT_TYPES[number] {
  const normalized = value.toLowerCase().trim().replace(/[\s-]+/g, '_')
  if (VALID_EMPLOYMENT_TYPES.includes(normalized as any)) {
    return normalized as typeof VALID_EMPLOYMENT_TYPES[number]
  }
  // Common mappings
  const mappings: Record<string, typeof VALID_EMPLOYMENT_TYPES[number]> = {
    'full': 'full_time',
    'fulltime': 'full_time',
    'part': 'part_time',
    'parttime': 'part_time',
    'contractor': 'contract',
    'temp': 'temporary',
  }
  return mappings[normalized] || 'full_time'
}

function normalizeStatus(value: string): typeof VALID_STATUSES[number] {
  const normalized = value.toLowerCase().trim()
  if (VALID_STATUSES.includes(normalized as any)) {
    return normalized as typeof VALID_STATUSES[number]
  }
  return 'active'
}

function findOrgUnitByName(orgUnits: OrgUnit[], name: string): OrgUnit | undefined {
  const normalizedName = name.toLowerCase().trim()

  // First try exact match on name
  let match = orgUnits.find(ou => ou.name.toLowerCase().trim() === normalizedName)
  if (match) return match

  // Then try exact match on code
  match = orgUnits.find(ou => ou.code.toLowerCase().trim() === normalizedName)
  if (match) return match

  // Then try partial match on name
  match = orgUnits.find(ou => ou.name.toLowerCase().includes(normalizedName))
  if (match) return match

  // Then try partial match on code
  match = orgUnits.find(ou => ou.code.toLowerCase().includes(normalizedName))
  if (match) return match

  return undefined
}

// ============================================================================
// PARSE FUNCTIONS
// ============================================================================

/**
 * Parse CSV content into position import rows
 */
export function parseCSV(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csvText.split('\n').filter(line => line.trim())
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row')
  }

  const headers = lines[0]!.split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!
    // Handle CSV parsing with quoted values
    const values: string[] = []
    let current = ''
    let inQuotes = false

    for (let j = 0; j < line.length; j++) {
      const char = line[j]!
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''))
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim().replace(/^"|"$/g, '')) // Add last value

    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    rows.push(row)
  }

  return { headers, rows }
}

/**
 * Parse Excel file content into position import rows
 */
export function parseExcel(buffer: ArrayBuffer): { headers: string[]; rows: Record<string, string>[] } {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('Excel file has no sheets')
  }

  const sheet = workbook.Sheets[firstSheetName]
  if (!sheet) {
    throw new Error('Could not read Excel sheet')
  }

  const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1 })

  if (data.length < 2) {
    throw new Error('Excel file must have at least a header row and one data row')
  }

  const headers = (data[0] as string[]).map(h => String(h || '').trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < data.length; i++) {
    const rowData = data[i] as any[]
    if (!rowData || rowData.every(cell => !cell)) continue // Skip empty rows

    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = String(rowData[index] ?? '').trim()
    })
    rows.push(row)
  }

  return { headers, rows }
}

/**
 * Map headers to standard column names for basic import
 */
function mapHeaders(headers: string[]): Record<string, string> {
  const headerMap: Record<string, string> = {}

  const columnMappings: Record<string, string[]> = {
    'Title': ['title', 'position title', 'position name', 'name'],
    'Code': ['code', 'position code', 'pos code', 'id'],
    'Description': ['description', 'desc', 'details'],
    'Designation': ['designation', 'sub title', 'role detail'],
    'Org Unit': ['org unit', 'organization unit', 'orgunit', 'department', 'dept', 'unit'],
    'Employment Type': ['employment type', 'type', 'employment', 'job type'],
    'Status': ['status', 'state', 'active'],
  }

  headers.forEach(header => {
    const normalizedHeader = normalizeHeader(header)
    for (const [standardName, aliases] of Object.entries(columnMappings)) {
      if (aliases.includes(normalizedHeader) || normalizedHeader === standardName.toLowerCase()) {
        headerMap[header] = standardName
        break
      }
    }
  })

  return headerMap
}

/**
 * Map headers to standard column names for hierarchy import
 */
function mapHierarchyHeaders(headers: string[]): Record<string, string> {
  const headerMap: Record<string, string> = {}

  const columnMappings: Record<string, string[]> = {
    'Position Code': ['position code', 'code', 'pos code', 'position id', 'id'],
    'Reports To Code': ['reports to code', 'reports to', 'parent code', 'parent', 'manager code', 'supervisor code', 'reports to position'],
  }

  headers.forEach(header => {
    const normalizedHeader = normalizeHeader(header)
    for (const [standardName, aliases] of Object.entries(columnMappings)) {
      if (aliases.includes(normalizedHeader) || normalizedHeader === standardName.toLowerCase()) {
        headerMap[header] = standardName
        break
      }
    }
  })

  return headerMap
}

/**
 * Calculate position level based on reporting chain
 */
function calculateLevel(
  positionId: string,
  positions: Position[],
  visited: Set<string> = new Set()
): number {
  // Prevent circular references
  if (visited.has(positionId)) {
    return 1
  }
  visited.add(positionId)

  const position = positions.find(p => p.id === positionId)
  if (!position || !position.reportsToPositionId) {
    return 1
  }

  return 1 + calculateLevel(position.reportsToPositionId, positions, visited)
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Enhanced validation that returns ALL rows with inline messages and suggestions
 */
export async function validatePositionImportEnhanced(
  companyId: string,
  rawRows: Record<string, string>[],
  headers: string[],
  groupId: string
): Promise<EnhancedPositionValidationResult> {
  const validatedRows: ValidatedPositionRow[] = []

  // Map headers to standard names
  const headerMap = mapHeaders(headers)
  const standardHeaders = ['Title', 'Code', 'Org Unit', 'Description', 'Employment Type', 'Status']

  // Load existing data
  const [orgUnits, existingPositions] = await Promise.all([
    getOrgUnits(companyId, groupId),
    getPositions(companyId, groupId)
  ])

  const existingCodes = new Set(existingPositions.map(p => p.code.toUpperCase()))
  const seenCodes = new Set<string>()

  // Create org unit candidates for fuzzy matching
  const orgUnitCandidates = orgUnits.map(ou => ({
    label: ou.name,
    value: ou.id,
    code: ou.code
  }))

  // Validate each row
  rawRows.forEach((row, index) => {
    const rowNumber = index + 2
    const messages: CellValidationMessage[] = []

    // Map row data using header mapping
    const mappedData: Record<string, string> = {}
    for (const [originalHeader, value] of Object.entries(row)) {
      const standardName = headerMap[originalHeader] || originalHeader
      mappedData[standardName] = value
    }

    const title = mappedData['Title'] || ''
    const code = (mappedData['Code'] || '').toUpperCase()
    const description = mappedData['Description'] || ''
    const designation = mappedData['Designation'] || title // Fallback
    const orgUnitName = mappedData['Org Unit'] || ''
    const employmentType = mappedData['Employment Type'] || 'full_time'

    let resolvedOrgUnitId: string | undefined

    // Validate Title
    if (!title.trim()) {
      messages.push({
        field: 'Title',
        message: 'Position title is required',
        severity: 'error'
      })
    }

    // Validate Code
    if (!code.trim()) {
      messages.push({
        field: 'Code',
        message: 'Position code is required',
        severity: 'error'
      })
    } else {
      if (seenCodes.has(code)) {
        messages.push({
          field: 'Code',
          message: `Duplicate code "${code}" in this file (row ${Array.from(seenCodes).indexOf(code) + 2})`,
          severity: 'error'
        })
      } else {
        seenCodes.add(code)
      }

      if (existingCodes.has(code)) {
        messages.push({
          field: 'Code',
          message: `Code "${code}" already exists in the system`,
          severity: 'error'
        })
      }
    }

    // Validate Org Unit with suggestions
    if (!orgUnitName.trim()) {
      messages.push({
        field: 'Org Unit',
        message: 'Organization unit is required',
        severity: 'error'
      })
    } else {
      const orgUnit = findOrgUnitByName(orgUnits, orgUnitName)
      if (orgUnit) {
        resolvedOrgUnitId = orgUnit.id
      } else {
        // Try fuzzy matching
        const matches = SpellCheckService.findBestMatches(
          orgUnitName,
          orgUnitCandidates.map(c => ({ label: c.label, value: c.value })),
          0.4, // Lower threshold for more suggestions
          3
        )

        const suggestion = matches.length > 0 ? {
          value: matches[0]!.value,
          label: matches[0]!.label,
          confidence: matches[0]!.score
        } : undefined

        messages.push({
          field: 'Org Unit',
          message: `Organization unit "${orgUnitName}" not found`,
          severity: 'error',
          suggestion
        })
      }
    }

    // Validate Employment Type (warning only)
    if (employmentType && !VALID_EMPLOYMENT_TYPES.includes(employmentType.toLowerCase().replace(/[\s-]+/g, '_') as any)) {
      messages.push({
        field: 'Employment Type',
        message: `Unknown type "${employmentType}", will default to "full_time"`,
        severity: 'warning'
      })
    }

    // Determine row status
    const hasError = messages.some(m => m.severity === 'error')
    const hasWarning = messages.some(m => m.severity === 'warning')
    const status: ValidatedPositionRow['status'] = hasError ? 'error' : hasWarning ? 'warning' : 'success'

    validatedRows.push({
      rowNumber,
      data: mappedData,
      messages,
      status,
      resolvedOrgUnitId
    })
  })

  const errorRows = validatedRows.filter(r => r.status === 'error').length
  const warningRows = validatedRows.filter(r => r.status === 'warning').length
  const validRows = validatedRows.filter(r => r.status === 'success').length

  return {
    validatedRows,
    headers: standardHeaders,
    orgUnits,
    summary: {
      totalRows: rawRows.length,
      validRows,
      errorRows,
      warningRows
    }
  }
}

/**
 * Update a row's data and revalidate
 */
export function revalidatePositionRow(
  row: ValidatedPositionRow,
  field: string,
  newValue: string,
  orgUnits: OrgUnit[],
  existingCodes: Set<string>,
  allRows: ValidatedPositionRow[]
): ValidatedPositionRow {
  // Update the data
  const updatedData = { ...row.data, [field]: newValue }

  // Rebuild messages
  const messages: CellValidationMessage[] = []
  const orgUnitCandidates = orgUnits.map(ou => ({
    label: ou.name,
    value: ou.id
  }))

  const title = updatedData['Title'] || ''
  const code = (updatedData['Code'] || '').toUpperCase()
  const description = updatedData['Description'] || ''
  const designation = updatedData['Designation'] || title // Fallback
  const orgUnitName = updatedData['Org Unit'] || ''
  const employmentType = updatedData['Employment Type'] || 'full_time'

  let resolvedOrgUnitId: string | undefined

  // Validate Title
  if (!title.trim()) {
    messages.push({
      field: 'Title',
      message: 'Position title is required',
      severity: 'error'
    })
  }

  // Validate Code
  if (!code.trim()) {
    messages.push({
      field: 'Code',
      message: 'Position code is required',
      severity: 'error'
    })
  } else {
    // Check duplicates in other rows
    const duplicateRow = allRows.find(r =>
      r.rowNumber !== row.rowNumber &&
      (r.data['Code'] || '').toUpperCase() === code
    )
    if (duplicateRow) {
      messages.push({
        field: 'Code',
        message: `Duplicate code "${code}" in row ${duplicateRow.rowNumber}`,
        severity: 'error'
      })
    }

    if (existingCodes.has(code)) {
      messages.push({
        field: 'Code',
        message: `Code "${code}" already exists in the system`,
        severity: 'error'
      })
    }
  }

  // Validate Org Unit
  if (!orgUnitName.trim()) {
    messages.push({
      field: 'Org Unit',
      message: 'Organization unit is required',
      severity: 'error'
    })
  } else {
    const orgUnit = findOrgUnitByName(orgUnits, orgUnitName)
    if (orgUnit) {
      resolvedOrgUnitId = orgUnit.id
    } else {
      const matches = SpellCheckService.findBestMatches(orgUnitName, orgUnitCandidates, 0.4, 3)
      const suggestion = matches.length > 0 ? {
        value: matches[0]!.value,
        label: matches[0]!.label,
        confidence: matches[0]!.score
      } : undefined

      messages.push({
        field: 'Org Unit',
        message: `Organization unit "${orgUnitName}" not found`,
        severity: 'error',
        suggestion
      })
    }
  }

  // Validate Employment Type
  if (employmentType && !VALID_EMPLOYMENT_TYPES.includes(employmentType.toLowerCase().replace(/[\s-]+/g, '_') as any)) {
    messages.push({
      field: 'Employment Type',
      message: `Unknown type "${employmentType}", will default to "full_time"`,
      severity: 'warning'
    })
  }

  const hasError = messages.some(m => m.severity === 'error')
  const hasWarning = messages.some(m => m.severity === 'warning')
  const status: ValidatedPositionRow['status'] = hasError ? 'error' : hasWarning ? 'warning' : 'success'

  return {
    ...row,
    data: updatedData,
    messages,
    status,
    resolvedOrgUnitId
  }
}

/**
 * Execute import from validated rows
 */
export async function executePositionImportFromValidated(
  companyId: string,
  rows: ValidatedPositionRow[],
  orgUnits: OrgUnit[],
  userId: string,
  groupId: string
): Promise<PositionImportResult> {
  const result: PositionImportResult = {
    success: 0,
    failed: 0,
    errors: [],
    createdPositions: []
  }

  // Only process rows without errors
  const validRows = rows.filter(r => r.status !== 'error')

  for (const row of validRows) {
    try {
      const orgUnit = row.resolvedOrgUnitId
        ? orgUnits.find(ou => ou.id === row.resolvedOrgUnitId)
        : findOrgUnitByName(orgUnits, row.data['Org Unit'] || '')

      if (!orgUnit) {
        result.failed++
        result.errors.push({
          rowNumber: row.rowNumber,
          code: row.data['Code'] || '',
          error: `Organization unit not resolved`
        })
        continue
      }

      const scope: PositionScope = {
        orgUnits: [orgUnit.id],
        locations: [],
        productLines: [],
        processes: [],
        equipmentTypes: []
      }

      const approvalAuthority: ApprovalAuthority = {
        canApproveProjects: false,
        canApproveBudgets: false,
        canApproveQuality: false,
        canApproveSafety: false,
        canApproveTimeOff: false,
        customApprovals: []
      }

      const positionData: Omit<Position, 'id' | 'createdAt' | 'updatedAt'> = {
        companyId,
        orgUnitId: orgUnit.id,
        title: row.data['Title'] || '',
        code: (row.data['Code'] || '').toUpperCase(),
        description: row.data['Description'] || '',
        level: 1,
        scope,
        responsibilities: [],
        requiredSkills: [],
        optionalSkills: [],
        certifications: [],
        reportsToPositionId: null,
        employmentType: normalizeEmploymentType(row.data['Employment Type'] || 'full_time'),
        approvalAuthority,
        status: normalizeStatus(row.data['Status'] || 'active'),
        createdBy: userId,
        updatedBy: userId
      }

      const position = await createPosition(companyId, positionData, userId, groupId)
      result.success++
      result.createdPositions.push(position)
    } catch (error: any) {
      result.failed++
      result.errors.push({
        rowNumber: row.rowNumber,
        code: row.data['Code'] || '',
        error: error.message || 'Failed to create position'
      })
    }
  }

  return result
}

/**
 * Validate imported position data
 */
export async function validatePositionImport(
  companyId: string,
  rawRows: Record<string, string>[],
  headers: string[],
  groupId: string
): Promise<PositionImportValidationResult> {
  const errors: PositionImportValidationError[] = []
  const warnings: PositionImportValidationError[] = []
  const validRows: PositionImportRow[] = []

  // Map headers to standard names
  const headerMap = mapHeaders(headers)

  // Check required columns
  const mappedHeaders = Object.values(headerMap)
  const missingRequired = POSITION_IMPORT_SCHEMA.required.filter(
    col => !mappedHeaders.includes(col)
  )

  if (missingRequired.length > 0) {
    errors.push({
      rowNumber: 0,
      field: 'headers',
      message: `Missing required columns: ${missingRequired.join(', ')}. Expected columns: ${POSITION_IMPORT_SCHEMA.required.join(', ')}`,
      severity: 'error'
    })
    return {
      isValid: false,
      rows: [],
      errors,
      warnings,
      summary: {
        totalRows: rawRows.length,
        validRows: 0,
        errorRows: rawRows.length,
        warningRows: 0
      }
    }
  }

  // Load existing data for validation
  const [orgUnits, existingPositions] = await Promise.all([
    getOrgUnits(companyId, groupId),
    getPositions(companyId, groupId)
  ])

  const existingCodes = new Set(existingPositions.map(p => p.code.toUpperCase()))
  const seenCodes = new Set<string>()

  // Validate each row
  rawRows.forEach((row, index) => {
    const rowNumber = index + 2 // +2 because row 1 is header, and we want 1-indexed

    // Map row data using header mapping
    const mappedRow: Record<string, string> = {}
    for (const [originalHeader, value] of Object.entries(row)) {
      const standardName = headerMap[originalHeader] || originalHeader
      mappedRow[standardName] = value
    }

    const title = mappedRow['Title'] || ''
    const code = (mappedRow['Code'] || '').toUpperCase()
    const description = mappedRow['Description'] || ''
    const designation = mappedRow['Designation'] || title // Fallback
    const orgUnitName = mappedRow['Org Unit'] || ''
    const employmentType = mappedRow['Employment Type'] || 'full_time'
    const status = mappedRow['Status'] || 'active'

    let hasError = false

    // Validate Title
    if (!title.trim()) {
      errors.push({
        rowNumber,
        field: 'Title',
        message: 'Position title is required',
        severity: 'error'
      })
      hasError = true
    }

    // Validate Code
    if (!code.trim()) {
      errors.push({
        rowNumber,
        field: 'Code',
        message: 'Position code is required',
        severity: 'error'
      })
      hasError = true
    } else {
      // Check for duplicate codes in file
      if (seenCodes.has(code)) {
        errors.push({
          rowNumber,
          field: 'Code',
          message: `Duplicate position code "${code}" found in file`,
          severity: 'error'
        })
        hasError = true
      } else {
        seenCodes.add(code)
      }

      // Check for existing codes in database
      if (existingCodes.has(code)) {
        errors.push({
          rowNumber,
          field: 'Code',
          message: `Position code "${code}" already exists in the system`,
          severity: 'error'
        })
        hasError = true
      }
    }

    // Validate Org Unit
    if (!orgUnitName.trim()) {
      errors.push({
        rowNumber,
        field: 'Org Unit',
        message: 'Organization unit is required',
        severity: 'error'
      })
      hasError = true
    } else {
      const orgUnit = findOrgUnitByName(orgUnits, orgUnitName)
      if (!orgUnit) {
        errors.push({
          rowNumber,
          field: 'Org Unit',
          message: `Organization unit "${orgUnitName}" not found. Available units: ${orgUnits.map(ou => ou.name).slice(0, 5).join(', ')}${orgUnits.length > 5 ? '...' : ''}`,
          severity: 'error'
        })
        hasError = true
      }
    }

    // Validate Employment Type (warning only)
    if (employmentType && !VALID_EMPLOYMENT_TYPES.includes(employmentType.toLowerCase().replace(/[\s-]+/g, '_') as any)) {
      warnings.push({
        rowNumber,
        field: 'Employment Type',
        message: `Unknown employment type "${employmentType}", defaulting to "full_time"`,
        severity: 'warning'
      })
    }

    if (!hasError) {
      validRows.push({
        rowNumber,
        title: title.trim(),
        code: code.trim(),
        description: description.trim(),
        designation: designation.trim(),
        orgUnitName: orgUnitName.trim(),
        employmentType: normalizeEmploymentType(employmentType),
        status: normalizeStatus(status)
      })
    }
  })

  const errorRowNumbers = new Set(errors.filter(e => e.severity === 'error').map(e => e.rowNumber))
  const warningRowNumbers = new Set(warnings.map(w => w.rowNumber))

  return {
    isValid: errors.length === 0,
    rows: validRows,
    errors,
    warnings,
    summary: {
      totalRows: rawRows.length,
      validRows: validRows.length,
      errorRows: errorRowNumbers.size,
      warningRows: warningRowNumbers.size
    }
  }
}

// ============================================================================
// IMPORT EXECUTION
// ============================================================================

/**
 * Execute position import - create positions from validated rows
 */
export async function executePositionImport(
  companyId: string,
  rows: PositionImportRow[],
  userId: string,
  groupId: string
): Promise<PositionImportResult> {
  const result: PositionImportResult = {
    success: 0,
    failed: 0,
    errors: [],
    createdPositions: []
  }

  // Load org units for ID resolution
  const orgUnits = await getOrgUnits(companyId, groupId)

  // Process each row
  for (const row of rows) {
    try {
      // Find org unit
      const orgUnit = findOrgUnitByName(orgUnits, row.orgUnitName)
      if (!orgUnit) {
        result.failed++
        result.errors.push({
          rowNumber: row.rowNumber,
          code: row.code,
          error: `Organization unit "${row.orgUnitName}" not found`
        })
        continue
      }

      // Create default scope
      const scope: PositionScope = {
        orgUnits: [orgUnit.id],
        locations: [],
        productLines: [],
        processes: [],
        equipmentTypes: []
      }

      // Create default approval authority
      const approvalAuthority: ApprovalAuthority = {
        canApproveProjects: false,
        canApproveBudgets: false,
        canApproveQuality: false,
        canApproveSafety: false,
        canApproveTimeOff: false,
        customApprovals: []
      }

      // Create position data
      const positionData: Omit<Position, 'id' | 'createdAt' | 'updatedAt'> = {
        companyId,
        orgUnitId: orgUnit.id,
        title: row.title,
        code: row.code,
        description: row.description,
        level: 1, // Will be calculated based on org unit hierarchy
        scope,
        responsibilities: [],
        requiredSkills: [],
        optionalSkills: [],
        certifications: [],
        reportsToPositionId: null, // Phase 1: No reports to
        employmentType: row.employmentType as Position['employmentType'],
        approvalAuthority,
        status: row.status as Position['status'],
        createdBy: userId,
        updatedBy: userId
      }

      // Create position
      const position = await createPosition(companyId, positionData, userId, groupId)
      result.success++
      result.createdPositions.push(position)
    } catch (error: any) {
      result.failed++
      result.errors.push({
        rowNumber: row.rowNumber,
        code: row.code,
        error: error.message || 'Failed to create position'
      })
    }
  }

  return result
}

/**
 * Generate sample CSV content for position import
 */
export function generateSampleCSV(): string {
  const headers = ['Title', 'Code', 'Org Unit', 'Designation', 'Description', 'Employment Type', 'Status']
  const sampleRows = [
    ['Production Manager', 'PM-001', 'Manufacturing', 'Manager - Production', 'Oversees production operations', 'full_time', 'active'],
    ['Quality Engineer', 'QE-001', 'Quality Assurance', 'Engineer - QA', 'Ensures product quality standards', 'full_time', 'active'],
    ['HR Specialist', 'HR-001', 'Human Resources', 'HR Lead', 'Handles HR operations', 'full_time', 'active'],
  ]

  const csvContent = [
    headers.join(','),
    ...sampleRows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  return csvContent
}

/**
 * Generate sample Excel file for position import
 */
export function generateSampleExcel(): Uint8Array {
  const headers = ['Title', 'Code', 'Org Unit', 'Designation', 'Description', 'Employment Type', 'Status']
  const sampleRows = [
    ['Production Manager', 'PM-001', 'Manufacturing', 'Manager - Production', 'Oversees production operations', 'full_time', 'active'],
    ['Quality Engineer', 'QE-001', 'Quality Assurance', 'Engineer - QA', 'Ensures product quality standards', 'full_time', 'active'],
    ['HR Specialist', 'HR-001', 'Human Resources', 'HR Lead', 'Handles HR operations', 'full_time', 'active'],
  ]

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows])

  // Set column widths
  worksheet['!cols'] = [
    { wch: 25 }, // Title
    { wch: 12 }, // Code
    { wch: 20 }, // Org Unit
    { wch: 20 }, // Designation
    { wch: 40 }, // Description
    { wch: 15 }, // Employment Type
    { wch: 10 }, // Status
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Positions')

  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
}

// ============================================================================
// HIERARCHY IMPORT - PHASE 2
// ============================================================================

/**
 * Enhanced hierarchy validation with suggestions
 */
export async function validateHierarchyImportEnhanced(
  companyId: string,
  rawRows: Record<string, string>[],
  headers: string[],
  groupId: string
): Promise<EnhancedHierarchyValidationResult> {
  const validatedRows: ValidatedHierarchyRow[] = []

  // Map headers
  const headerMap = mapHierarchyHeaders(headers)
  const standardHeaders = ['Position Code', 'Reports To Code']

  // Load existing positions
  const positions = await getPositions(companyId, groupId)
  const positionsByCode = new Map<string, Position>()
  positions.forEach(p => positionsByCode.set(p.code.toUpperCase(), p))

  // Create candidates for fuzzy matching
  const positionCandidates = positions.map(p => ({
    label: `${p.code} - ${p.title}`,
    value: p.id,
    code: p.code
  }))

  // Track relationships for circular reference detection
  const relationships: Map<string, string> = new Map()

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2
    const messages: CellValidationMessage[] = []

    // Map row data
    const mappedData: Record<string, string> = {}
    for (const [originalHeader, value] of Object.entries(row)) {
      const standardName = headerMap[originalHeader] || originalHeader
      mappedData[standardName] = value
    }

    const positionCode = (mappedData['Position Code'] || '').toUpperCase().trim()
    const reportsToCode = (mappedData['Reports To Code'] || '').toUpperCase().trim()

    let resolvedPositionId: string | undefined
    let resolvedReportsToId: string | undefined

    // Validate Position Code
    if (!positionCode) {
      messages.push({
        field: 'Position Code',
        message: 'Position code is required',
        severity: 'error'
      })
    } else {
      const position = positionsByCode.get(positionCode)
      if (position) {
        resolvedPositionId = position.id
      } else {
        const matches = SpellCheckService.findBestMatches(
          positionCode,
          positionCandidates.map(c => ({ label: c.code, value: c.value })),
          0.5,
          3
        )
        const suggestion = matches.length > 0 ? {
          value: matches[0]!.value,
          label: positions.find(p => p.id === matches[0]!.value)?.code || matches[0]!.label,
          confidence: matches[0]!.score
        } : undefined

        messages.push({
          field: 'Position Code',
          message: `Position "${positionCode}" not found`,
          severity: 'error',
          suggestion
        })
      }
    }

    // Validate Reports To Code
    if (!reportsToCode) {
      messages.push({
        field: 'Reports To Code',
        message: 'Reports To code is required',
        severity: 'error'
      })
    } else {
      const parentPosition = positionsByCode.get(reportsToCode)
      if (parentPosition) {
        resolvedReportsToId = parentPosition.id
      } else {
        const matches = SpellCheckService.findBestMatches(
          reportsToCode,
          positionCandidates.map(c => ({ label: c.code, value: c.value })),
          0.5,
          3
        )
        const suggestion = matches.length > 0 ? {
          value: matches[0]!.value,
          label: positions.find(p => p.id === matches[0]!.value)?.code || matches[0]!.label,
          confidence: matches[0]!.score
        } : undefined

        messages.push({
          field: 'Reports To Code',
          message: `Parent position "${reportsToCode}" not found`,
          severity: 'error',
          suggestion
        })
      }

      // Self-reference check
      if (positionCode && positionCode === reportsToCode) {
        messages.push({
          field: 'Reports To Code',
          message: 'Position cannot report to itself',
          severity: 'error'
        })
      }
    }

    // Track for circular reference check
    if (positionCode && reportsToCode) {
      relationships.set(positionCode, reportsToCode)
    }

    const hasError = messages.some(m => m.severity === 'error')
    const hasWarning = messages.some(m => m.severity === 'warning')
    const status: ValidatedHierarchyRow['status'] = hasError ? 'error' : hasWarning ? 'warning' : 'success'

    validatedRows.push({
      rowNumber,
      data: mappedData,
      messages,
      status,
      resolvedPositionId,
      resolvedReportsToId
    })
  })

  // Check for circular references
  for (const [code] of relationships) {
    const visited = new Set<string>()
    let current: string | undefined = code

    while (current) {
      if (visited.has(current)) {
        // Find the row with this code and add circular reference error
        const row = validatedRows.find(r => (r.data['Position Code'] || '').toUpperCase() === code)
        if (row && !row.messages.some(m => m.message.includes('Circular'))) {
          row.messages.push({
            field: 'Reports To Code',
            message: `Circular reference detected in hierarchy`,
            severity: 'error'
          })
          row.status = 'error'
        }
        break
      }
      visited.add(current)
      current = relationships.get(current)
    }
  }

  const errorRows = validatedRows.filter(r => r.status === 'error').length
  const warningRows = validatedRows.filter(r => r.status === 'warning').length
  const validRows = validatedRows.filter(r => r.status === 'success').length

  return {
    validatedRows,
    headers: standardHeaders,
    positions,
    summary: {
      totalRows: rawRows.length,
      validRows,
      errorRows,
      warningRows
    }
  }
}

/**
 * Revalidate a hierarchy row after edit
 */
export function revalidateHierarchyRow(
  row: ValidatedHierarchyRow,
  field: string,
  newValue: string,
  positions: Position[],
  allRows: ValidatedHierarchyRow[]
): ValidatedHierarchyRow {
  const updatedData = { ...row.data, [field]: newValue }
  const messages: CellValidationMessage[] = []

  const positionsByCode = new Map<string, Position>()
  positions.forEach(p => positionsByCode.set(p.code.toUpperCase(), p))

  const positionCandidates = positions.map(p => ({
    label: p.code,
    value: p.id
  }))

  const positionCode = (updatedData['Position Code'] || '').toUpperCase().trim()
  const reportsToCode = (updatedData['Reports To Code'] || '').toUpperCase().trim()

  let resolvedPositionId: string | undefined
  let resolvedReportsToId: string | undefined

  // Validate Position Code
  if (!positionCode) {
    messages.push({
      field: 'Position Code',
      message: 'Position code is required',
      severity: 'error'
    })
  } else {
    const position = positionsByCode.get(positionCode)
    if (position) {
      resolvedPositionId = position.id
    } else {
      const matches = SpellCheckService.findBestMatches(positionCode, positionCandidates, 0.5, 3)
      const suggestion = matches.length > 0 ? {
        value: matches[0]!.value,
        label: positions.find(p => p.id === matches[0]!.value)?.code || '',
        confidence: matches[0]!.score
      } : undefined

      messages.push({
        field: 'Position Code',
        message: `Position "${positionCode}" not found`,
        severity: 'error',
        suggestion
      })
    }
  }

  // Validate Reports To Code
  if (!reportsToCode) {
    messages.push({
      field: 'Reports To Code',
      message: 'Reports To code is required',
      severity: 'error'
    })
  } else {
    const parentPosition = positionsByCode.get(reportsToCode)
    if (parentPosition) {
      resolvedReportsToId = parentPosition.id
    } else {
      const matches = SpellCheckService.findBestMatches(reportsToCode, positionCandidates, 0.5, 3)
      const suggestion = matches.length > 0 ? {
        value: matches[0]!.value,
        label: positions.find(p => p.id === matches[0]!.value)?.code || '',
        confidence: matches[0]!.score
      } : undefined

      messages.push({
        field: 'Reports To Code',
        message: `Parent position "${reportsToCode}" not found`,
        severity: 'error',
        suggestion
      })
    }

    if (positionCode && positionCode === reportsToCode) {
      messages.push({
        field: 'Reports To Code',
        message: 'Position cannot report to itself',
        severity: 'error'
      })
    }
  }

  const hasError = messages.some(m => m.severity === 'error')
  const hasWarning = messages.some(m => m.severity === 'warning')
  const status: ValidatedHierarchyRow['status'] = hasError ? 'error' : hasWarning ? 'warning' : 'success'

  return {
    ...row,
    data: updatedData,
    messages,
    status,
    resolvedPositionId,
    resolvedReportsToId
  }
}

/**
 * Execute hierarchy import from validated rows
 */
export async function executeHierarchyImportFromValidated(
  companyId: string,
  rows: ValidatedHierarchyRow[],
  userId: string,
  groupId: string
): Promise<PositionHierarchyImportResult> {
  const result: PositionHierarchyImportResult = {
    success: 0,
    failed: 0,
    errors: [],
    updatedPositions: []
  }

  const validRows = rows.filter(r => r.status !== 'error')
  const positions = await getPositions(companyId, groupId)
  const positionMap = new Map<string, Position>()
  positions.forEach(p => positionMap.set(p.id, p))

  // First pass: Update parent references
  for (const row of validRows) {
    try {
      if (!row.resolvedPositionId || !row.resolvedReportsToId) {
        result.failed++
        result.errors.push({
          rowNumber: row.rowNumber,
          code: row.data['Position Code'] || '',
          error: 'Position ID or Reports To ID not resolved'
        })
        continue
      }

      await updatePosition(
        companyId,
        row.resolvedPositionId,
        { reportsToPositionId: row.resolvedReportsToId },
        userId,
        groupId
      )

      const position = positionMap.get(row.resolvedPositionId)
      if (position) {
        position.reportsToPositionId = row.resolvedReportsToId
      }

      result.success++
    } catch (error: any) {
      result.failed++
      result.errors.push({
        rowNumber: row.rowNumber,
        code: row.data['Position Code'] || '',
        error: error.message || 'Failed to update position'
      })
    }
  }

  // Second pass: Recalculate levels
  const updatedPositions = await getPositions(companyId, groupId)
  for (const row of validRows) {
    if (row.resolvedPositionId) {
      try {
        const level = calculateLevel(row.resolvedPositionId, updatedPositions)
        await updatePosition(companyId, row.resolvedPositionId, { level }, userId, groupId)

        const position = updatedPositions.find(p => p.id === row.resolvedPositionId)
        if (position) {
          position.level = level
          result.updatedPositions.push(position)
        }
      } catch (error: any) {
        console.error(`Error updating level for position:`, error)
      }
    }
  }

  return result
}

/**
 * Validate hierarchy import data
 */
export async function validateHierarchyImport(
  companyId: string,
  rawRows: Record<string, string>[],
  headers: string[],
  groupId: string
): Promise<PositionHierarchyValidationResult> {
  const errors: PositionImportValidationError[] = []
  const warnings: PositionImportValidationError[] = []
  const validRows: PositionHierarchyImportRow[] = []

  // Map headers to standard names
  const headerMap = mapHierarchyHeaders(headers)

  // Check required columns
  const mappedHeaders = Object.values(headerMap)
  const missingRequired = POSITION_HIERARCHY_SCHEMA.required.filter(
    col => !mappedHeaders.includes(col)
  )

  if (missingRequired.length > 0) {
    errors.push({
      rowNumber: 0,
      field: 'headers',
      message: `Missing required columns: ${missingRequired.join(', ')}. Expected columns: ${POSITION_HIERARCHY_SCHEMA.required.join(', ')}`,
      severity: 'error'
    })
    return {
      isValid: false,
      rows: [],
      errors,
      warnings,
      summary: {
        totalRows: rawRows.length,
        validRows: 0,
        errorRows: rawRows.length,
        warningRows: 0
      }
    }
  }

  // Load existing positions
  const existingPositions = await getPositions(companyId, groupId)
  const positionsByCode = new Map<string, Position>()
  existingPositions.forEach(p => {
    positionsByCode.set(p.code.toUpperCase(), p)
  })

  // Track relationships for circular reference detection
  const relationships: Map<string, string> = new Map()

  // Validate each row
  rawRows.forEach((row, index) => {
    const rowNumber = index + 2

    // Map row data using header mapping
    const mappedRow: Record<string, string> = {}
    for (const [originalHeader, value] of Object.entries(row)) {
      const standardName = headerMap[originalHeader] || originalHeader
      mappedRow[standardName] = value
    }

    const positionCode = (mappedRow['Position Code'] || '').toUpperCase().trim()
    const reportsToCode = (mappedRow['Reports To Code'] || '').toUpperCase().trim()

    let hasError = false

    // Validate Position Code
    if (!positionCode) {
      errors.push({
        rowNumber,
        field: 'Position Code',
        message: 'Position code is required',
        severity: 'error'
      })
      hasError = true
    } else {
      const position = positionsByCode.get(positionCode)
      if (!position) {
        errors.push({
          rowNumber,
          field: 'Position Code',
          message: `Position with code "${positionCode}" not found in the system`,
          severity: 'error'
        })
        hasError = true
      }
    }

    // Validate Reports To Code
    if (!reportsToCode) {
      errors.push({
        rowNumber,
        field: 'Reports To Code',
        message: 'Reports To code is required',
        severity: 'error'
      })
      hasError = true
    } else {
      const parentPosition = positionsByCode.get(reportsToCode)
      if (!parentPosition) {
        errors.push({
          rowNumber,
          field: 'Reports To Code',
          message: `Parent position with code "${reportsToCode}" not found in the system`,
          severity: 'error'
        })
        hasError = true
      }

      // Check for self-reference
      if (positionCode === reportsToCode) {
        errors.push({
          rowNumber,
          field: 'Reports To Code',
          message: `Position "${positionCode}" cannot report to itself`,
          severity: 'error'
        })
        hasError = true
      }
    }

    // Track relationship for circular reference check
    if (positionCode && reportsToCode) {
      relationships.set(positionCode, reportsToCode)
    }

    if (!hasError) {
      const position = positionsByCode.get(positionCode)
      const parentPosition = positionsByCode.get(reportsToCode)

      validRows.push({
        rowNumber,
        positionCode,
        reportsToCode,
        positionId: position?.id,
        reportsToPositionId: parentPosition?.id
      })
    }
  })

  // Check for circular references
  for (const [code, reportsTo] of relationships) {
    const visited = new Set<string>()
    let current: string | undefined = code

    while (current) {
      if (visited.has(current)) {
        errors.push({
          rowNumber: 0,
          field: 'Hierarchy',
          message: `Circular reference detected: ${Array.from(visited).join(' -> ')} -> ${current}`,
          severity: 'error'
        })
        break
      }
      visited.add(current)
      current = relationships.get(current)
    }
  }

  const errorRowNumbers = new Set(errors.filter(e => e.severity === 'error').map(e => e.rowNumber))
  const warningRowNumbers = new Set(warnings.map(w => w.rowNumber))

  return {
    isValid: errors.length === 0,
    rows: validRows,
    errors,
    warnings,
    summary: {
      totalRows: rawRows.length,
      validRows: validRows.length,
      errorRows: errorRowNumbers.size,
      warningRows: warningRowNumbers.size
    }
  }
}

/**
 * Execute hierarchy import - update positions with parent references
 */
export async function executeHierarchyImport(
  companyId: string,
  rows: PositionHierarchyImportRow[],
  userId: string,
  groupId: string
): Promise<PositionHierarchyImportResult> {
  const result: PositionHierarchyImportResult = {
    success: 0,
    failed: 0,
    errors: [],
    updatedPositions: []
  }

  // Load current positions for level calculation
  const positions = await getPositions(companyId, groupId)
  const positionMap = new Map<string, Position>()
  positions.forEach(p => positionMap.set(p.id, p))

  // First pass: Update all parent references
  for (const row of rows) {
    try {
      if (!row.positionId || !row.reportsToPositionId) {
        result.failed++
        result.errors.push({
          rowNumber: row.rowNumber,
          code: row.positionCode,
          error: 'Position ID or Reports To ID not resolved'
        })
        continue
      }

      // Update position with parent reference
      await updatePosition(
        companyId,
        row.positionId,
        { reportsToPositionId: row.reportsToPositionId },
        userId,
        groupId
      )

      // Update local map for level calculation
      const position = positionMap.get(row.positionId)
      if (position) {
        position.reportsToPositionId = row.reportsToPositionId
      }

      result.success++
    } catch (error: any) {
      result.failed++
      result.errors.push({
        rowNumber: row.rowNumber,
        code: row.positionCode,
        error: error.message || 'Failed to update position'
      })
    }
  }

  // Second pass: Recalculate levels for all updated positions
  const updatedPositions = await getPositions(companyId, groupId)
  for (const row of rows) {
    if (row.positionId) {
      try {
        const level = calculateLevel(row.positionId, updatedPositions)
        await updatePosition(
          companyId,
          row.positionId,
          { level },
          userId,
          groupId
        )

        const position = updatedPositions.find(p => p.id === row.positionId)
        if (position) {
          position.level = level
          result.updatedPositions.push(position)
        }
      } catch (error: any) {
        console.error(`Error updating level for position ${row.positionCode}:`, error)
        // Don't fail the whole import for level calculation errors
      }
    }
  }

  return result
}

/**
 * Generate sample CSV content for hierarchy import
 */
export function generateHierarchySampleCSV(): string {
  const headers = ['Position Code', 'Reports To Code']
  const sampleRows = [
    ['CTO-001', 'CEO-001'],
    ['CFO-001', 'CEO-001'],
    ['DEV-MGR-001', 'CTO-001'],
    ['QA-MGR-001', 'CTO-001'],
    ['SR-DEV-001', 'DEV-MGR-001'],
  ]

  const csvContent = [
    headers.join(','),
    ...sampleRows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  return csvContent
}

/**
 * Generate sample Excel file for hierarchy import
 */
export function generateHierarchySampleExcel(): Uint8Array {
  const headers = ['Position Code', 'Reports To Code']
  const sampleRows = [
    ['CTO-001', 'CEO-001'],
    ['CFO-001', 'CEO-001'],
    ['DEV-MGR-001', 'CTO-001'],
    ['QA-MGR-001', 'CTO-001'],
    ['SR-DEV-001', 'DEV-MGR-001'],
  ]

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows])

  // Set column widths
  worksheet['!cols'] = [
    { wch: 20 }, // Position Code
    { wch: 20 }, // Reports To Code
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Position Hierarchy')

  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
}
