'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Clock, AlertCircle, Database, Cloud, BarChart3 } from 'lucide-react'

interface PipelineSummaryData {
  totalFiles: number
  successCount: number
  failureCount: number
  inProgressCount: number
  skippedCount: number
  successRate: number
  recentErrors: Array<{
    fileName: string
    errorMessage: string
    timestamp: Date
  }>
  latestDataDate: Date | null
  pipelineStages: {
    staging: { status: string; lastRun: Date | null }
    transform: { status: string; lastRun: Date | null }
    metabase: { status: string; lastRun: Date | null }
  }
}

interface PipelineSummaryProps {
  refreshInterval?: number
}

export function PipelineSummary({ refreshInterval = 30000 }: PipelineSummaryProps) {
  const [data, setData] = useState<PipelineSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/pipeline/summary')
      const result = await response.json()

      if (result.success) {
        // Convert date strings to Date objects
        const processedData: PipelineSummaryData = {
          ...result.data,
          latestDataDate: result.data.latestDataDate 
            ? new Date(result.data.latestDataDate) 
            : null,
          recentErrors: result.data.recentErrors.map((e: any) => ({
            ...e,
            timestamp: new Date(e.timestamp),
          })),
          pipelineStages: {
            staging: {
              status: result.data.pipelineStages.staging.status,
              lastRun: result.data.pipelineStages.staging.lastRun
                ? new Date(result.data.pipelineStages.staging.lastRun)
                : null,
            },
            transform: {
              status: result.data.pipelineStages.transform.status,
              lastRun: result.data.pipelineStages.transform.lastRun
                ? new Date(result.data.pipelineStages.transform.lastRun)
                : null,
            },
            metabase: {
              status: result.data.pipelineStages.metabase.status,
              lastRun: result.data.pipelineStages.metabase.lastRun
                ? new Date(result.data.pipelineStages.metabase.lastRun)
                : null,
            },
          },
        }
        setData(processedData)
        setError(null)
      } else {
        setError(result.error || 'Failed to fetch pipeline summary')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pipeline summary')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
    const interval = setInterval(fetchSummary, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshInterval])

  if (loading && !data) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-2">Error loading pipeline summary</p>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'unknown':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />
      default:
        return <XCircle className="h-5 w-5 text-red-600" />
    }
  }

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never'
    const dateObj = date instanceof Date ? date : new Date(date)
    // Check if date is valid (not epoch or invalid)
    if (isNaN(dateObj.getTime()) || dateObj.getTime() === 0) {
      return 'Never'
    }
    return dateObj.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Files</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.totalFiles}</p>
            </div>
            <Database className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{data.successRate}%</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{data.inProgressCount}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Errors</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{data.failureCount}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Pipeline Flow */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pipeline Flow</h3>
        <div className="flex items-center justify-between">
          <div className="flex-1 text-center">
            <Cloud className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">GCP Bucket</p>
            <p className="text-xs text-gray-500 mt-1">julley-pms-dev</p>
            <div className="mt-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
            </div>
          </div>

          <div className="flex-1 mx-4">
            <div className="h-0.5 bg-gray-300"></div>
            <div className="flex justify-center -mt-3">
              <div className="bg-white px-2">
                <span className="text-xs text-gray-500">→</span>
              </div>
            </div>
          </div>

          <div className="flex-1 text-center">
            <Database className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">ClickHouse Staging</p>
            <p className="text-xs text-gray-500 mt-1">Self-hosted GCP</p>
            <div className="mt-2">
              {getStatusIcon(data.pipelineStages.staging.status)}
            </div>
            {data.pipelineStages.staging.lastRun && (
              <p className="text-xs text-gray-400 mt-1">
                {formatDate(data.pipelineStages.staging.lastRun)}
              </p>
            )}
          </div>

          <div className="flex-1 mx-4">
            <div className="h-0.5 bg-gray-300"></div>
            <div className="flex justify-center -mt-3">
              <div className="bg-white px-2">
                <span className="text-xs text-gray-500">→</span>
              </div>
            </div>
          </div>

          <div className="flex-1 text-center">
            <Database className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">ClickHouse Analytics</p>
            <p className="text-xs text-gray-500 mt-1">Self-hosted GCP</p>
            <div className="mt-2">
              {getStatusIcon(data.pipelineStages.transform.status)}
            </div>
            {data.pipelineStages.transform.lastRun && (
              <p className="text-xs text-gray-400 mt-1">
                {formatDate(data.pipelineStages.transform.lastRun)}
              </p>
            )}
          </div>

          <div className="flex-1 mx-4">
            <div className="h-0.5 bg-gray-300"></div>
            <div className="flex justify-center -mt-3">
              <div className="bg-white px-2">
                <span className="text-xs text-gray-500">→</span>
              </div>
            </div>
          </div>

          <div className="flex-1 text-center">
            <BarChart3 className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">Metabase</p>
            <p className="text-xs text-gray-500 mt-1">Live</p>
            <div className="mt-2">
              {getStatusIcon(data.pipelineStages.metabase.status)}
            </div>
            {data.pipelineStages.metabase.lastRun && (
              <p className="text-xs text-gray-400 mt-1">
                {formatDate(data.pipelineStages.metabase.lastRun)}
              </p>
            )}
          </div>
        </div>

        {data.latestDataDate && 
         data.latestDataDate instanceof Date && 
         !isNaN(data.latestDataDate.getTime()) && 
         data.latestDataDate.getTime() !== 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Latest Data: <span className="font-medium text-gray-900">{formatDate(data.latestDataDate)}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

