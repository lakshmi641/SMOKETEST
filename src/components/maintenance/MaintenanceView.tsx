'use client'

import { Wrench, Server, Database, ShieldAlert } from 'lucide-react'
import type { MaintenanceMode, MaintenanceReason } from '@/types/tenant-schema'

const REASON_CONFIG: Record<
  MaintenanceReason,
  { title: string; description: string; icon: typeof Wrench; bgClass: string; borderClass: string; textClass: string }
> = {
  system_down: {
    title: 'System temporarily unavailable',
    description: 'We are performing maintenance. Please try again shortly.',
    icon: Server,
    bgClass: 'bg-amber-50 dark:bg-amber-950/30',
    borderClass: 'border-amber-200 dark:border-amber-800',
    textClass: 'text-amber-800 dark:text-amber-200',
  },
  migration: {
    title: 'System migration in progress',
    description: 'We are upgrading our systems to serve you better. Access will be restored soon.',
    icon: Database,
    bgClass: 'bg-blue-50 dark:bg-blue-950/30',
    borderClass: 'border-blue-200 dark:border-blue-800',
    textClass: 'text-blue-800 dark:text-blue-200',
  },
  system_breach: {
    title: 'Access temporarily restricted',
    description: 'We have temporarily restricted access for security reasons. We will restore access as soon as it is safe.',
    icon: ShieldAlert,
    bgClass: 'bg-red-50 dark:bg-red-950/30',
    borderClass: 'border-red-200 dark:border-red-800',
    textClass: 'text-red-800 dark:text-red-200',
  },
}

export function MaintenanceView({ maintenance, companyName }: { maintenance: MaintenanceMode; companyName?: string }) {
  const reason = maintenance.reason && REASON_CONFIG[maintenance.reason] ? maintenance.reason : 'system_down'
  const config = REASON_CONFIG[reason]
  const Icon = config.icon

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-xl p-8 text-center">
        <div className="mb-6">
          <div
            className={`mx-auto h-20 w-20 rounded-full flex items-center justify-center ${config.bgClass} ${config.borderClass} border-2`}
          >
            <Icon className={`h-10 w-10 ${config.textClass}`} />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {config.title}
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          {config.description}
        </p>
        <div
          className={`border rounded-lg p-4 mb-6 text-left ${config.bgClass} ${config.borderClass} border`}
        >
          {maintenance.message ? (
            <p className={`font-medium ${config.textClass}`}>{maintenance.message}</p>
          ) : (
            <p className={`font-medium ${config.textClass}`}>Thank you for your patience.</p>
          )}
          {maintenance.estimatedEnd && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Estimated restoration: {maintenance.estimatedEnd}
            </p>
          )}
        </div>
        {companyName && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Organization: <span className="font-semibold text-gray-700 dark:text-gray-300">{companyName}</span>
          </p>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-400">
          If you have urgent questions, please contact your administrator or support.
        </p>
      </div>
    </div>
  )
}
