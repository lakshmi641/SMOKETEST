'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface FieldMapping {
  fileColumn: string
  stagingColumn: string
  required: boolean
  status: 'mapped' | 'unmapped' | 'warning'
  reason?: string
}

interface ValidationResult {
  isValid: boolean
  fileFormat: string
  supportedFormat: boolean
  targetTable: string
  mappedFields: FieldMapping[]
  unmappedFields: Array<{ fileColumn: string; reason: string }>
  missingRequiredFields: Array<{ stagingColumn: string; reason: string }>
  warnings: string[]
  errors: string[]
}

interface FileValidationProps {
  file: File | null
  fileType?: string
  onValidationComplete?: (result: ValidationResult) => void
  onProceed?: () => void
  onCancel?: () => void
}

export function FileValidation({
  file,
  fileType,
  onValidationComplete,
  onProceed,
  onCancel,
}: FileValidationProps) {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateFile = async () => {
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (fileType) {
        formData.append('fileType', fileType)
      }

      const response = await fetch('/api/pipeline/validate', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        setValidationResult(result.data)
        if (onValidationComplete) {
          onValidationComplete(result.data)
        }
      } else {
        setError(result.error || 'Failed to validate file')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate file')
    } finally {
      setLoading(false)
    }
  }

  // Auto-validate when file changes
  useEffect(() => {
    if (file) {
      validateFile()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  if (!file) {
    return null
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Validating file...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-2">Validation Error</p>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!validationResult) {
    return null
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'mapped':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'unmapped':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      default:
        return null
    }
  }

  const getStatusBadge = () => {
    if (validationResult.isValid && validationResult.errors.length === 0) {
      return <Badge className="bg-green-100 text-green-800">Valid</Badge>
    } else if (validationResult.errors.length > 0) {
      return <Badge className="bg-red-100 text-red-800">Invalid</Badge>
    } else {
      return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          File Validation: {file.name}
        </h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">Format:</span>
          <span className="font-medium">
            {validationResult.supportedFormat ? (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                {validationResult.fileFormat} - Supported
              </span>
            ) : (
              <span className="text-red-600">{validationResult.fileFormat} - Not Supported</span>
            )}
          </span>
          <span className="text-gray-600">Target Table:</span>
          <span className="font-medium">{validationResult.targetTable}</span>
          <span className="text-gray-600">Status:</span>
          {getStatusBadge()}
        </div>
      </div>

      {/* Field Mapping Table */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Field Mapping:</h4>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Column</TableHead>
                <TableHead>Staging Column</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {validationResult.mappedFields.map((field, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{field.fileColumn}</TableCell>
                  <TableCell>{field.stagingColumn}</TableCell>
                  <TableCell>{field.required ? 'Yes' : 'No'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(field.status)}
                      <span className="capitalize">{field.status}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {validationResult.unmappedFields.map((field, index) => (
                <TableRow key={`unmapped-${index}`} className="bg-gray-50">
                  <TableCell className="font-medium">{field.fileColumn}</TableCell>
                  <TableCell className="text-gray-400">-</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-red-600">Unmapped</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Warnings */}
      {validationResult.warnings.length > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800 mb-1">Warnings:</p>
              <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                {validationResult.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Errors */}
      {validationResult.errors.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <div className="flex items-start gap-2">
            <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-800 mb-1">Errors:</p>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                {validationResult.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {onProceed && (
          <Button
            onClick={onProceed}
            disabled={!validationResult.isValid || validationResult.errors.length > 0}
          >
            Proceed with Upload
          </Button>
        )}
      </div>
    </div>
  )
}

