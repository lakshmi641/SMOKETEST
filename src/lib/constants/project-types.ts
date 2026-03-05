/**
 * System project type definitions.
 * These are built-in types; custom types are stored in Firestore per company.
 */

import type { ProjectType } from '@/types/project-task-template'

export interface SystemProjectTypeDef {
  code: ProjectType
  name: string
  description: string
}

export const SYSTEM_PROJECT_TYPES: SystemProjectTypeDef[] = [
  { code: 'rft', name: 'Request from Teams (RFT)', description: 'Standard Request from Teams workflow' },
  { code: 'reports', name: 'Reports', description: 'Reporting and analytics projects' },
  { code: 'compliance', name: 'Compliance (Statutory)', description: 'Statutory and compliance projects' },
  { code: 'other', name: 'Other', description: 'General or uncategorized projects' },
]

export function getSystemProjectTypeByCode(code: string): SystemProjectTypeDef | undefined {
  return SYSTEM_PROJECT_TYPES.find((t) => t.code === code)
}
