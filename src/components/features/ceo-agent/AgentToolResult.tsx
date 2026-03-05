'use client'

import React from 'react'
import { CheckCircle2, AlertTriangle, TrendingUp, Activity, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface AgentToolResultProps {
  toolName: string
  result: any
}

export function AgentToolResult({ toolName, result }: AgentToolResultProps) {
  if (!result) return null

  // Parse result if it's a stringified JSON
  let data = result
  if (typeof result === 'string') {
    try {
      data = JSON.parse(result)
    } catch {
      // Keep as string if not JSON
    }
  }

  // Render specific KPI cards based on tool name
  switch (toolName) {
    case 'get_strategic_health':
      return (
        <div className="mt-2 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold uppercase text-gray-500">Strategic Health</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-green-50 p-3 rounded-lg border border-green-100">
              <div className="text-xs text-green-600 font-medium">Health Score</div>
              <div className="text-2xl font-bold text-green-700">{data.score || data.health_score || 'N/A'}%</div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
              <div className="text-xs text-blue-600 font-medium">Tasks Completed</div>
              <div className="text-2xl font-bold text-blue-700">{data.completion_rate || '0'}%</div>
            </div>
          </div>
        </div>
      )

    case 'get_portfolio_status':
      return (
        <div className="mt-2 mb-4 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase text-gray-500">Portfolio Status</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${data.at_risk > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {data.at_risk > 0 ? `${data.at_risk} At Risk` : 'Healthy'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <div className="text-center">
              <div className="font-bold text-gray-900">{data.total_projects || 0}</div>
              <div className="text-[10px] text-gray-500">Total</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-900">{data.active || 0}</div>
              <div className="text-[10px] text-gray-500">Active</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-900">{data.completed || 0}</div>
              <div className="text-[10px] text-gray-500">Done</div>
            </div>
          </div>
        </div>
      )

    case 'search_knowledge':
      const results = Array.isArray(data.results) ? data.results : []
      if (results.length === 0) return null
      return (
        <div className="mt-2 mb-4 space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="w-3 h-3 text-gray-400" />
            <span className="text-[10px] font-semibold uppercase text-gray-400">Knowledge Sources</span>
          </div>
          {results.slice(0, 2).map((item: any, i: number) => (
            <div key={i} className="bg-gray-50 p-2 rounded border border-gray-100 text-xs text-gray-600">
              <div className="font-medium text-gray-900 mb-0.5">{item.document_name}</div>
              <div className="line-clamp-2 italic opacity-80">"{item.text}"</div>
            </div>
          ))}
        </div>
      )

    default:
      // Generic JSON view for other tools
      if (typeof data === 'object') {
        return (
          <div className="mt-2 mb-4 text-xs bg-gray-50 p-2 rounded border border-gray-200 font-mono overflow-x-auto">
            <div className="font-bold text-gray-500 mb-1">{toolName}</div>
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        )
      }
      return (
        <div className="mt-2 mb-4 text-xs text-gray-500 italic border-l-2 border-gray-300 pl-2">
          {String(data)}
        </div>
      )
  }
}
