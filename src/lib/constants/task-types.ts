/**
 * Default/system task type definitions.
 * Used in the admin types table and as fallback in TaskForm when Firestore has no task types.
 */

export interface SystemTaskTypeDef {
  name: string
  color?: string
  order: number
}

export const SYSTEM_TASK_TYPES: SystemTaskTypeDef[] = [
  { name: 'Operations', color: '#2563eb', order: 0 },
  { name: 'Regular', color: '#10b981', order: 1 },
  { name: 'Compliance', color: '#7c3aed', order: 2 },
  { name: 'Maintenance', color: '#ea580c', order: 3 },
  { name: 'Training', color: '#0891b2', order: 4 },
  { name: 'Project', color: '#6d28d9', order: 5 },
  { name: 'Safety', color: '#dc2626', order: 6 },
  { name: 'Quality', color: '#16a34a', order: 7 },
  { name: 'Other', color: '#6b7280', order: 8 },
]
