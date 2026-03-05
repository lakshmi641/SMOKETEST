'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, Clock, AlertCircle, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface PipelineStage {
  eventType: string
  status: string
  timestamp: Date
  rowCount: number | null
  error: string | null
}

interface FileProcessingStatus {
  fileName: string
  latestStatus: 'success' | 'fail' | 'in_progress' | 'skipped_duplicate'
  lastProcessed: Date | null
  lastSuccess: Date | null
  lastFailure: Date | null
  processingAttempts: number
  sourceRowCount: number | null
  targetRowCount: number | null
  lastError: string | null
  stages: PipelineStage[]
}

interface PipelineStatusProps {
  fileName?: string
}

export function PipelineStatus({ fileName }: PipelineStatusProps) {
  const [status, setStatus] = useState<FileProcessingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!fileName) return

    const fetchStatus = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/pipeline/status?fileName=${encodeURIComponent(fileName)}`)
        const result = await response.json()

        if (result.success) {
          setStatus(result.data)
          setError(null)
        } else {
          setError(result.error || 'Failed to fetch file status')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch file status')
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
  }, [fileName])

  if (!fileName) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500">Select a file to view processing details</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-8">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-2">Error loading file status</p>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No processing status found for this file</p>
      </div>
    )
  }

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'in_progress':
        return <Clock className="h-5 w-5 text-yellow-600" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800">Success</Badge>
      case 'fail':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>
      case 'in_progress':
        return <Badge className="bg-yellow-100 text-yellow-800">In Progress</Badge>
      case 'skipped_duplicate':
        return <Badge className="bg-gray-100 text-gray-800">Skipped</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Build timeline from stages
  const timelineStages = [
    {
      name: 'Upload to GCP',
      icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
      status: 'success',
      description: 'File uploaded to GCP bucket',
    },
    {
      name: 'Staging Load',
      stage: status.stages.find((s) => s.eventType === 'Staging Load'),
      icon: getStatusIcon(
        status.stages.find((s) => s.eventType === 'Staging Load')?.status || 'unknown'
      ),
      description: 'Load raw data to ClickHouse staging',
    },
    {
      name: 'Transform (dbt)',
      stage: status.stages.find((s) => s.eventType === 'Transform'),
      icon: getStatusIcon(
        status.stages.find((s) => s.eventType === 'Transform')?.status || 'unknown'
      ),
      description: 'Transform data to analytics tables',
    },
    {
      name: 'Metabase Sync',
      icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
      status: 'success',
      description: 'Dashboard updated',
    },
  ]

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          File Processing Details: {status.fileName}
        </h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">Status:</span>
          {getStatusBadge(status.latestStatus)}
          <span className="text-gray-600">Attempts:</span>
          <span className="font-medium">{status.processingAttempts}</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        <h4 className="font-medium text-gray-900">Timeline:</h4>
        {timelineStages.map((stage, index) => (
          <div key={index} className="flex gap-4">
            <div className="flex flex-col items-center">
              {stage.icon}
              {index < timelineStages.length - 1 && (
                <div className="w-0.5 h-12 bg-gray-300 mt-2"></div>
              )}
            </div>
            <div className="flex-1 pb-6">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="font-medium text-gray-900">[{index + 1}] {stage.name}</p>
                  <p className="text-sm text-gray-600">{stage.description}</p>
                </div>
                {stage.stage && (
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      {formatDate(new Date(stage.stage.timestamp))}
                    </p>
                    {stage.stage.rowCount !== null && (
                      <p className="text-xs text-gray-500">
                        {stage.stage.rowCount.toLocaleString()} rows
                      </p>
                    )}
                  </div>
                )}
              </div>
              {stage.stage?.error && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-sm text-red-800">{stage.stage.error}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Source Rows</p>
            <p className="text-lg font-semibold text-gray-900">
              {status.sourceRowCount?.toLocaleString() || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Target Rows</p>
            <p className="text-lg font-semibold text-gray-900">
              {status.targetRowCount?.toLocaleString() || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Last Processed</p>
            <p className="text-sm font-medium text-gray-900">{formatDate(status.lastProcessed)}</p>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {status.lastError && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-sm font-medium text-red-800 mb-1">Last Error:</p>
          <p className="text-sm text-red-700">{status.lastError}</p>
        </div>
      )}
    </div>
  )
}

