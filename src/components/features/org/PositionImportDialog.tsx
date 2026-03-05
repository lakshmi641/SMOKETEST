'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCompany } from '@/contexts/CompanyContext'
import {
  parseCSV,
  parseExcel,
  validatePositionImportEnhanced,
  validateHierarchyImportEnhanced,
  executePositionImportFromValidated,
  executeHierarchyImportFromValidated,
  revalidatePositionRow,
  revalidateHierarchyRow,
  generateSampleCSV,
  generateSampleExcel,
  generateHierarchySampleCSV,
  generateHierarchySampleExcel,
  type PositionImportMode,
  type EnhancedPositionValidationResult,
  type EnhancedHierarchyValidationResult,
  type PositionImportResult,
  type PositionHierarchyImportResult,
  POSITION_IMPORT_SCHEMA,
  POSITION_HIERARCHY_SCHEMA
} from '@/lib/services/org/position-import-service'
import { getPositions } from '@/lib/services/org/org-services'
import { PositionImportReviewTable, HierarchyImportReviewTable } from './PositionImportReviewTable'
import toast from 'react-hot-toast'
import {
  Upload,
  FileSpreadsheet,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  GitBranch,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface PositionImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPositionsImported: () => void
}

type ImportStep = 'select_mode' | 'upload' | 'review' | 'importing' | 'complete'

export function PositionImportDialog({
  open,
  onOpenChange,
  onPositionsImported
}: PositionImportDialogProps) {
  const { companyId, groupId, currentCompanyUser } = useCompany()
  const [step, setStep] = useState<ImportStep>('select_mode')
  const [importMode, setImportMode] = useState<PositionImportMode>('basic')
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState(false)

  // Enhanced validation results
  const [basicValidationResult, setBasicValidationResult] = useState<EnhancedPositionValidationResult | null>(null)
  const [hierarchyValidationResult, setHierarchyValidationResult] = useState<EnhancedHierarchyValidationResult | null>(null)

  // Import results
  const [basicImportResult, setBasicImportResult] = useState<PositionImportResult | null>(null)
  const [hierarchyImportResult, setHierarchyImportResult] = useState<PositionHierarchyImportResult | null>(null)

  // For revalidation
  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set())

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset state when dialog closes
  const handleClose = () => {
    setStep('select_mode')
    setImportMode('basic')
    setBasicValidationResult(null)
    setBasicImportResult(null)
    setHierarchyValidationResult(null)
    setHierarchyImportResult(null)
    setUploading(false)
    setImporting(false)
    onOpenChange(false)
  }

  // Select import mode
  const handleModeSelect = (mode: PositionImportMode) => {
    setImportMode(mode)
    setStep('upload')
  }

  // Download templates
  const downloadSampleCSV = () => {
    const csvContent = importMode === 'basic' ? generateSampleCSV() : generateHierarchySampleCSV()
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = importMode === 'basic' ? 'positions_import_template.csv' : 'position_hierarchy_template.csv'
    link.click()
    URL.revokeObjectURL(link.href)
    toast.success('CSV template downloaded')
  }

  const downloadSampleExcel = () => {
    const excelData = importMode === 'basic' ? generateSampleExcel() : generateHierarchySampleExcel()
    const blob = new Blob([new Uint8Array(excelData)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = importMode === 'basic' ? 'positions_import_template.xlsx' : 'position_hierarchy_template.xlsx'
    link.click()
    URL.revokeObjectURL(link.href)
    toast.success('Excel template downloaded')
  }

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !companyId || !groupId) {
      if (!groupId) toast.error('Enterprise Group ID is required')
      return
    }

    const isCSV = file.name.endsWith('.csv')
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

    if (!isCSV && !isExcel) {
      toast.error('Please select a CSV or Excel file')
      return
    }

    try {
      setUploading(true)

      let headers: string[]
      let rows: Record<string, string>[]

      if (isCSV) {
        const text = await file.text()
        const parsed = parseCSV(text)
        headers = parsed.headers
        rows = parsed.rows
      } else {
        const buffer = await file.arrayBuffer()
        const parsed = parseExcel(buffer)
        headers = parsed.headers
        rows = parsed.rows
      }

      if (rows.length === 0) {
        toast.error('No data rows found in file')
        return
      }

      // Use enhanced validation
      if (importMode === 'basic') {
        const result = await validatePositionImportEnhanced(companyId, rows, headers, groupId)
        setBasicValidationResult(result)

        // Store existing codes for revalidation
        const positions = await getPositions(companyId, groupId)
        setExistingCodes(new Set(positions.map(p => p.code.toUpperCase())))

        setStep('review')
        toast.success(`Loaded ${result.summary.totalRows} rows for review`)
      } else {
        const result = await validateHierarchyImportEnhanced(companyId, rows, headers, groupId)
        setHierarchyValidationResult(result)
        setStep('review')
        toast.success(`Loaded ${result.summary.totalRows} rows for review`)
      }
    } catch (error: any) {
      console.error('Error processing file:', error)
      toast.error(error.message || 'Failed to process file')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Handle row update (revalidation)
  const handleBasicRowUpdate = (rowNumber: number, field: string, value: string) => {
    if (!basicValidationResult) return

    const updatedRows = basicValidationResult.validatedRows.map(row => {
      if (row.rowNumber === rowNumber) {
        return revalidatePositionRow(
          row,
          field,
          value,
          basicValidationResult.orgUnits,
          existingCodes,
          basicValidationResult.validatedRows
        )
      }
      return row
    })

    const errorRows = updatedRows.filter(r => r.status === 'error').length
    const warningRows = updatedRows.filter(r => r.status === 'warning').length
    const validRows = updatedRows.filter(r => r.status === 'success').length

    setBasicValidationResult({
      ...basicValidationResult,
      validatedRows: updatedRows,
      summary: {
        totalRows: updatedRows.length,
        validRows,
        errorRows,
        warningRows
      }
    })
  }

  const handleHierarchyRowUpdate = (rowNumber: number, field: string, value: string) => {
    if (!hierarchyValidationResult) return

    const updatedRows = hierarchyValidationResult.validatedRows.map(row => {
      if (row.rowNumber === rowNumber) {
        return revalidateHierarchyRow(
          row,
          field,
          value,
          hierarchyValidationResult.positions,
          hierarchyValidationResult.validatedRows
        )
      }
      return row
    })

    const errorRows = updatedRows.filter(r => r.status === 'error').length
    const warningRows = updatedRows.filter(r => r.status === 'warning').length
    const validRows = updatedRows.filter(r => r.status === 'success').length

    setHierarchyValidationResult({
      ...hierarchyValidationResult,
      validatedRows: updatedRows,
      summary: {
        totalRows: updatedRows.length,
        validRows,
        errorRows,
        warningRows
      }
    })
  }

  // Execute import
  const handleImport = async () => {
    if (!companyId || !currentCompanyUser) return

    try {
      setImporting(true)
      setStep('importing')

      if (importMode === 'basic' && basicValidationResult) {
        const result = await executePositionImportFromValidated(
          companyId,
          basicValidationResult.validatedRows,
          basicValidationResult.orgUnits,
          currentCompanyUser.id || 'import-user',
          groupId!
        )
        setBasicImportResult(result)

        if (result.success > 0) {
          toast.success(`Successfully imported ${result.success} position(s)`)
          onPositionsImported()
        }
        if (result.failed > 0) {
          toast.error(`Failed to import ${result.failed} position(s)`)
        }
      } else if (importMode === 'hierarchy' && hierarchyValidationResult) {
        const result = await executeHierarchyImportFromValidated(
          companyId,
          hierarchyValidationResult.validatedRows,
          currentCompanyUser.id || 'import-user',
          groupId!
        )
        setHierarchyImportResult(result)

        if (result.success > 0) {
          toast.success(`Successfully updated ${result.success} position(s)`)
          onPositionsImported()
        }
        if (result.failed > 0) {
          toast.error(`Failed to update ${result.failed} position(s)`)
        }
      }

      setStep('complete')
    } catch (error: any) {
      console.error('Error importing:', error)
      toast.error(error.message || 'Failed to import')
      setStep('review')
    } finally {
      setImporting(false)
    }
  }

  // Navigation
  const handleBackToModeSelect = () => {
    setStep('select_mode')
    setBasicValidationResult(null)
    setHierarchyValidationResult(null)
  }

  const handleBackToUpload = () => {
    setStep('upload')
    setBasicValidationResult(null)
    setHierarchyValidationResult(null)
  }

  // Get current data based on mode
  const validationResult = importMode === 'basic' ? basicValidationResult : hierarchyValidationResult
  const importResult = importMode === 'basic' ? basicImportResult : hierarchyImportResult
  const schema = importMode === 'basic' ? POSITION_IMPORT_SCHEMA : POSITION_HIERARCHY_SCHEMA

  // Count valid rows for import button
  const validRowCount = validationResult
    ? validationResult.validatedRows.filter(r => r.status !== 'error').length
    : 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 'select_mode' && 'Import Positions'}
            {step === 'upload' && (importMode === 'basic' ? 'Import Positions (Basic)' : 'Import Position Hierarchy')}
            {step === 'review' && 'Review & Edit Import Data'}
            {step === 'importing' && 'Importing...'}
            {step === 'complete' && 'Import Complete'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select_mode' && 'Choose the type of import you want to perform.'}
            {step === 'upload' && (importMode === 'basic'
              ? 'Upload a file to create new positions without hierarchy.'
              : 'Upload a file to set parent positions for existing positions.'
            )}
            {step === 'review' && 'Double-click cells to edit. Click "Resolve" to select from available options.'}
            {step === 'importing' && (importMode === 'basic' ? 'Creating positions...' : 'Updating hierarchy...')}
            {step === 'complete' && 'Import completed.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Step 1: Select Mode */}
          {step === 'select_mode' && (
            <div className="grid grid-cols-2 gap-4 py-6">
              <Card
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleModeSelect('basic')}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Import Positions (Basic)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    Create new positions without hierarchy. Use this first to import all positions.
                  </CardDescription>
                  <div className="mt-4">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Required columns:</p>
                    <div className="flex flex-wrap gap-1">
                      {POSITION_IMPORT_SCHEMA.required.map(col => (
                        <Badge key={col} variant="secondary" className="text-xs">{col}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleModeSelect('hierarchy')}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <GitBranch className="w-6 h-6 text-orange-500" />
                    </div>
                    <CardTitle className="text-lg">Import Position Hierarchy</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    Update existing positions with parent references. Use after basic import.
                  </CardDescription>
                  <div className="mt-4">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Required columns:</p>
                    <div className="flex flex-wrap gap-1">
                      {POSITION_HIERARCHY_SCHEMA.required.map(col => (
                        <Badge key={col} variant="secondary" className="text-xs">{col}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Upload */}
          {step === 'upload' && (
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label>Download Template</Label>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={downloadSampleCSV} className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    CSV Template
                  </Button>
                  <Button variant="outline" onClick={downloadSampleExcel} className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    Excel Template
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-medium">Required Columns:</p>
                <div className="flex flex-wrap gap-2">
                  {schema.required.map(col => (
                    <Badge key={col} variant="default">{col}</Badge>
                  ))}
                </div>
                {schema.optional.length > 0 && (
                  <>
                    <p className="text-sm font-medium mt-3">Optional Columns:</p>
                    <div className="flex flex-wrap gap-2">
                      {schema.optional.map(col => (
                        <Badge key={col} variant="secondary">{col}</Badge>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="border-2 border-dashed border-border rounded-lg p-8">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <FileSpreadsheet className="w-12 h-12 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium mb-1">Choose a CSV or Excel file</p>
                    <p className="text-xs text-muted-foreground">Supported: .csv, .xlsx, .xls</p>
                  </div>
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Choose File
                      </>
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review with Editable Table */}
          {step === 'review' && validationResult && (
            <div className="space-y-4 py-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-xl font-bold">{validationResult.summary.totalRows}</p>
                  <p className="text-xs text-muted-foreground">Total Rows</p>
                </div>
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg text-center">
                  <p className="text-xl font-bold text-emerald-600">{validationResult.summary.validRows}</p>
                  <p className="text-xs text-muted-foreground">Ready</p>
                </div>
                <div className="p-3 bg-rose-100 dark:bg-rose-900/20 rounded-lg text-center">
                  <p className="text-xl font-bold text-rose-600">{validationResult.summary.errorRows}</p>
                  <p className="text-xs text-muted-foreground">Errors</p>
                </div>
                <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-lg text-center">
                  <p className="text-xl font-bold text-amber-600">{validationResult.summary.warningRows}</p>
                  <p className="text-xs text-muted-foreground">Warnings</p>
                </div>
              </div>

              {/* Editable Table */}
              {importMode === 'basic' && basicValidationResult && (
                <PositionImportReviewTable
                  rows={basicValidationResult.validatedRows}
                  headers={basicValidationResult.headers}
                  orgUnits={basicValidationResult.orgUnits}
                  onRowUpdate={handleBasicRowUpdate}
                />
              )}

              {importMode === 'hierarchy' && hierarchyValidationResult && (
                <HierarchyImportReviewTable
                  rows={hierarchyValidationResult.validatedRows}
                  headers={hierarchyValidationResult.headers}
                  positions={hierarchyValidationResult.positions}
                  onRowUpdate={handleHierarchyRowUpdate}
                />
              )}

              {/* Help text */}
              <p className="text-xs text-muted-foreground text-center">
                Double-click any cell to edit. Click the "Resolve" button to see suggestions from system data.
              </p>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === 'importing' && (
            <div className="py-12 text-center">
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
              <p className="text-lg font-medium">
                {importMode === 'basic' ? 'Importing positions...' : 'Updating hierarchy...'}
              </p>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 'complete' && importResult && (
            <div className="space-y-6 py-4">
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    <span className="text-3xl font-bold text-emerald-600">{importResult.success}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {importMode === 'basic' ? 'Imported' : 'Updated'}
                  </p>
                </div>
                {importResult.failed > 0 && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <XCircle className="w-6 h-6 text-rose-600" />
                      <span className="text-3xl font-bold text-rose-600">{importResult.failed}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Failed</p>
                  </div>
                )}
              </div>

              {importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-rose-600">Import Errors:</Label>
                  <ScrollArea className="h-32 border rounded-lg">
                    <div className="p-3 space-y-2">
                      {importResult.errors.map((error, index) => (
                        <div key={index} className="text-sm text-rose-600">
                          <span className="font-medium">Row {error.rowNumber} ({error.code}):</span> {error.error}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {importResult.success > 0 && (
                <div className="p-4 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
                  <p className="text-emerald-700 dark:text-emerald-400">
                    {importMode === 'basic'
                      ? `${importResult.success} position(s) imported successfully.`
                      : `${importResult.success} position(s) updated with hierarchy.`
                    }
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {step === 'select_mode' && (
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
          )}

          {step === 'upload' && (
            <Button variant="outline" onClick={handleBackToModeSelect}>Back</Button>
          )}

          {step === 'review' && (
            <>
              <Button variant="outline" onClick={handleBackToUpload}>Back</Button>
              <Button
                onClick={handleImport}
                disabled={validRowCount === 0 || importing}
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {importMode === 'basic' ? 'Importing...' : 'Updating...'}
                  </>
                ) : (
                  <>
                    {importMode === 'basic'
                      ? `Import ${validRowCount} Position(s)`
                      : `Update ${validRowCount} Mapping(s)`
                    }
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'complete' && (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
