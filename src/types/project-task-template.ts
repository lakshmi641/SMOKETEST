// Project Task Template: defines a predefined set of tasks to generate for a project

export interface ProjectTaskTemplate {
  id: string
  name: string
  description: string
  category: 'manufacturing' | 'software' | 'marketing' | 'operations' | 'custom'
  projectType?: ProjectType
  department: string[]
  positionLevel?: number[]
  isActive: boolean
  isSystemTemplate: boolean
  tags: string[]
  usageCount: number
  createdBy: string
  createdAt: string
  updatedAt: string
  tasks: ProjectTaskDefinition[]
}

export interface ProjectTaskDefinition {
  id: string
  title: string
  description: string
  category: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  estimatedHours: number
  // Offset in days from project start date; can be negative or positive
  dueDateOffsetDays: number
  assignedPositionId: string
  definitionOfDone?: Array<{
    id: string
    text: string
    isRequired: boolean
    order: number
  }>
  tags?: string[]
}

// Firestore collections helper
export interface ProjectTaskTemplateCollections {
  projectTaskTemplates: ProjectTaskTemplate[]
}

export type ProjectType = 'rft' | 'reports' | 'compliance' | 'other'

export interface VirtualProjectTemplate extends ProjectTaskTemplate {
  projectType: ProjectType
  virtualId: string // e.g., 'virtual-rft-standard'
}


