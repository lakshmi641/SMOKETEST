import type { GeneratedTask } from '@/types/task-template-schema'

/**
 * Shared status color utility for consistent theming across all views
 * (List, Calendar, Gantt, etc.)
 */

export interface StatusColors {
  // Background colors (for list view rows, calendar cells)
  bg: string
  bgDark: string

  // Border colors (for list view left border)
  border: string

  // Dot/indicator colors (for calendar status dots)
  dot: string

  // Text colors (for calendar task text)
  text: string
  textDark: string

  // Hover colors (for list view hover states)
  hover: string
  hoverDark: string

  // Gradient colors (for Gantt chart bars)
  gradientFrom: string
  gradientTo: string
  gradientBorder: string
  gradientShadow: string

  // Bar colors (for calendar spanning bars)
  barBg: string
  barBorder: string
  barText: string
}

/**
 * Get consistent status colors for all views
 */
export function getStatusColors(status: GeneratedTask['status']): StatusColors {
  switch (status) {
    case 'open':
      return {
        bg: 'bg-sky-50',
        bgDark: 'dark:bg-sky-950/50',
        border: 'border-l-sky-500',
        dot: 'bg-sky-500',
        text: 'text-sky-700',
        textDark: 'dark:text-sky-300',
        hover: 'hover:bg-sky-100',
        hoverDark: 'dark:hover:bg-sky-950/70',
        gradientFrom: 'from-sky-500',
        gradientTo: 'to-sky-600',
        gradientBorder: 'border-sky-700',
        gradientShadow: 'shadow-sky-200',
        barBg: 'bg-sky-100',
        barBorder: 'border-sky-300',
        barText: 'text-sky-800',
      }
    case 'assigned':
      return {
        bg: 'bg-blue-50',
        bgDark: 'dark:bg-blue-950/50',
        border: 'border-l-blue-600',
        dot: 'bg-blue-600',
        text: 'text-blue-700',
        textDark: 'dark:text-blue-300',
        hover: 'hover:bg-blue-100',
        hoverDark: 'dark:hover:bg-blue-950/70',
        gradientFrom: 'from-blue-600',
        gradientTo: 'to-blue-700',
        gradientBorder: 'border-blue-700',
        gradientShadow: 'shadow-blue-200',
        barBg: 'bg-blue-100',
        barBorder: 'border-blue-300',
        barText: 'text-blue-800',
      }
    case 'in_progress':
      return {
        bg: 'bg-amber-50',
        bgDark: 'dark:bg-amber-950/50',
        border: 'border-l-amber-500',
        dot: 'bg-amber-500',
        text: 'text-amber-700',
        textDark: 'dark:text-amber-300',
        hover: 'hover:bg-amber-100',
        hoverDark: 'dark:hover:bg-amber-950/70',
        gradientFrom: 'from-amber-500',
        gradientTo: 'to-amber-600',
        gradientBorder: 'border-amber-700',
        gradientShadow: 'shadow-amber-200',
        barBg: 'bg-amber-100',
        barBorder: 'border-amber-300',
        barText: 'text-amber-800',
      }
    case 'on_hold':
      return {
        bg: 'bg-orange-50',
        bgDark: 'dark:bg-orange-950/50',
        border: 'border-l-orange-500',
        dot: 'bg-orange-500',
        text: 'text-orange-700',
        textDark: 'dark:text-orange-300',
        hover: 'hover:bg-orange-100',
        hoverDark: 'dark:hover:bg-orange-950/70',
        gradientFrom: 'from-orange-500',
        gradientTo: 'to-orange-600',
        gradientBorder: 'border-orange-700',
        gradientShadow: 'shadow-orange-200',
        barBg: 'bg-orange-100',
        barBorder: 'border-orange-300',
        barText: 'text-orange-800',
      }
    case 'completed':
      return {
        bg: 'bg-emerald-50',
        bgDark: 'dark:bg-emerald-950/50',
        border: 'border-l-emerald-500',
        dot: 'bg-emerald-500',
        text: 'text-emerald-700',
        textDark: 'dark:text-emerald-300',
        hover: 'hover:bg-emerald-100',
        hoverDark: 'dark:hover:bg-emerald-950/70',
        gradientFrom: 'from-emerald-500',
        gradientTo: 'to-emerald-600',
        gradientBorder: 'border-emerald-700',
        gradientShadow: 'shadow-emerald-200',
        barBg: 'bg-emerald-100',
        barBorder: 'border-emerald-300',
        barText: 'text-emerald-800',
      }
    case 'cancelled':
      return {
        bg: 'bg-red-50',
        bgDark: 'dark:bg-red-950/50',
        border: 'border-l-red-500',
        dot: 'bg-red-500',
        text: 'text-red-700',
        textDark: 'dark:text-red-300',
        hover: 'hover:bg-red-100',
        hoverDark: 'dark:hover:bg-red-950/70',
        gradientFrom: 'from-red-500',
        gradientTo: 'to-red-600',
        gradientBorder: 'border-red-700',
        gradientShadow: 'shadow-red-200',
        barBg: 'bg-red-100',
        barBorder: 'border-red-300',
        barText: 'text-red-800',
      }
    case 'escalated':
      return {
        bg: 'bg-purple-50',
        bgDark: 'dark:bg-purple-950/50',
        border: 'border-l-purple-500',
        dot: 'bg-purple-500',
        text: 'text-purple-700',
        textDark: 'dark:text-purple-300',
        hover: 'hover:bg-purple-100',
        hoverDark: 'dark:hover:bg-purple-950/70',
        gradientFrom: 'from-purple-500',
        gradientTo: 'to-purple-600',
        gradientBorder: 'border-purple-700',
        gradientShadow: 'shadow-purple-200',
        barBg: 'bg-purple-100',
        barBorder: 'border-purple-300',
        barText: 'text-purple-800',
      }
    case 'approval_required':
      return {
        bg: 'bg-indigo-50',
        bgDark: 'dark:bg-indigo-950/50',
        border: 'border-l-indigo-500',
        dot: 'bg-indigo-500',
        text: 'text-indigo-700',
        textDark: 'dark:text-indigo-300',
        hover: 'hover:bg-indigo-100',
        hoverDark: 'dark:hover:bg-indigo-950/70',
        gradientFrom: 'from-indigo-500',
        gradientTo: 'to-indigo-600',
        gradientBorder: 'border-indigo-700',
        gradientShadow: 'shadow-indigo-200',
        barBg: 'bg-indigo-100',
        barBorder: 'border-indigo-300',
        barText: 'text-indigo-800',
      }
    default:
      return {
        bg: 'bg-gray-50',
        bgDark: 'dark:bg-gray-900/50',
        border: 'border-l-gray-400',
        dot: 'bg-gray-400',
        text: 'text-gray-600',
        textDark: 'dark:text-gray-400',
        hover: 'hover:bg-gray-100',
        hoverDark: 'dark:hover:bg-gray-900/70',
        gradientFrom: 'from-gray-500',
        gradientTo: 'to-gray-600',
        gradientBorder: 'border-gray-700',
        gradientShadow: 'shadow-gray-200',
        barBg: 'bg-gray-100',
        barBorder: 'border-gray-300',
        barText: 'text-gray-800',
      }
  }
}

