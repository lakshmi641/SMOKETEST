'use client'

import { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react'
import { formatDate } from '@/lib/utils/date-utils'

interface DataTableProps {
  objectId: string
  companyId: string
  onRefresh?: () => void
  refreshTrigger?: number
}

export function DataTable({ objectId, companyId, onRefresh, refreshTrigger }: DataTableProps) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [columns, setColumns] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    if (!objectId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const url = `/api/data-objects/${objectId}/data?page=${page}&pageSize=${pageSize}`
      console.log('Fetching data from:', url)
      const response = await fetch(url)
      console.log('Response status:', response.status, response.statusText)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        let errorData: any = {};
        try {
          const text = await response.text();
          if (text) {
            errorData = JSON.parse(text);
          }
        } catch (e) {
          errorData = { error: 'Failed to parse error response' };
        }
        console.error('API error:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          url: response.url
        });
        setError(
          errorData.message ||
          errorData.error ||
          `HTTP ${response.status}: ${response.statusText || 'Unknown error'}`
        );
        setData([])
        setColumns([])
        setTotal(0)
        setTotalPages(0)
        return
      }

      const result = await response.json()
      console.log('DataTable API response:', result) // Debug log

      if (result.success) {
        setError(null) // Clear any previous errors
        setData(result.data || [])
        setTotal(result.pagination?.total || 0)
        setTotalPages(result.pagination?.totalPages || 0)

        // Extract columns from first row
        if (result.data && result.data.length > 0) {
          setColumns(Object.keys(result.data[0]))
        } else {
          setColumns([])
        }
      } else {
        console.error('API returned success:false', result)
        setError(result.message || result.error || 'Failed to fetch data')
        setData([])
        setColumns([])
        setTotal(0)
        setTotalPages(0)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setError(error instanceof Error ? error.message : 'Failed to load data')
      setData([])
      setColumns([])
      setTotal(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [objectId, page, refreshTrigger])

  const handleRefresh = () => {
    loadData()
    if (onRefresh) {
      onRefresh()
    }
  }

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '-'
    }
    if (typeof value === 'number') {
      // Format numbers with commas
      return value.toLocaleString('en-IN', { minimumFractionDigits: 2 })
    }
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      // Format dates
      return formatDate(value)
    }
    return String(value)
  }

  if (loading && data.length === 0 && !error) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-8">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-2">Error loading data</p>
          <p className="text-gray-600 text-sm">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No data available. Import data to get started.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header with refresh button */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Data Table</h3>
          <p className="text-sm text-gray-500">
            Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} records
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column} className="font-semibold">
                  {column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => (
                <TableRow key={index}>
                  {columns.map((column) => (
                    <TableCell key={column} className="max-w-xs truncate">
                      {formatValue(row[column])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

