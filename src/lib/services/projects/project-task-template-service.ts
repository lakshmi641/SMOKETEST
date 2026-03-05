// Service for managing Project Task Templates and applying them to projects

import { collection, doc, getDoc, getDocs, addDoc, updateDoc, query, where, orderBy, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { companySubcollectionPathSegments } from '@/lib/firestore-paths'
import { resolveEffectiveAssignment } from '@/lib/services/org/org-services'
import type { ProjectTaskTemplate, ProjectType } from '@/types/project-task-template'
import { getVirtualTemplateById, getTemplatesByProjectType } from '@/lib/constants/predefined-templates'

export class ProjectTaskTemplateService {
  static getCollectionRef(companyId: string, groupId?: string) {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'projectTaskTemplates')
    return collection(db, segments[0], ...segments.slice(1))
  }

  static async createTemplate(companyId: string, template: Omit<ProjectTaskTemplate, 'id' | 'createdAt' | 'updatedAt'>, groupId?: string): Promise<string> {
    const collRef = this.getCollectionRef(companyId, groupId)
    const docRef = await addDoc(collRef, {
      ...template,
      isActive: true, // Ensure template is active by default so it shows in filters
      projectType: template.projectType || 'other',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    return docRef.id
  }

  static async updateTemplate(companyId: string, templateId: string, updates: Partial<ProjectTaskTemplate>, groupId?: string): Promise<void> {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'projectTaskTemplates')
    const ref = doc(db, ...segments, templateId)
    await updateDoc(ref, { ...updates, updatedAt: new Date().toISOString() })
  }

  static async getTemplates(companyId: string, filters?: { isActive?: boolean; category?: string; projectType?: ProjectType }, groupId?: string): Promise<ProjectTaskTemplate[]> {
    const collRef = this.getCollectionRef(companyId, groupId)
    const snap = await getDocs(collRef)
    let templates = snap.docs.map(d => {
      const data = d.data() as any
      return {
        id: d.id,
        ...data,
        isActive: data.isActive !== undefined ? data.isActive : true // Default to true if missing (recovers old templates)
      }
    }) as ProjectTaskTemplate[]

    // Apply filters in-memory to avoid composite index requirements
    if (filters) {
      if (filters.isActive !== undefined) {
        templates = templates.filter(t => t.isActive === filters.isActive)
      }
      if (filters.category) {
        templates = templates.filter(t => t.category === filters.category)
      }
      if (filters.projectType) {
        templates = templates.filter(t => t.projectType === filters.projectType)
      }
    }

    // Sort in-memory
    templates.sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    const customTemplates = templates

    // Add virtual templates if projectType is provided (but skip if 'other' per user preference for custom templates only)
    let virtualTemplates: ProjectTaskTemplate[] = []
    if (filters?.projectType && filters.projectType !== 'other') {
      virtualTemplates = getTemplatesByProjectType(filters.projectType)
    }

    return [...virtualTemplates, ...customTemplates]
  }

  static async getTemplate(companyId: string, templateId: string, groupId?: string): Promise<ProjectTaskTemplate | null> {
    // Check for virtual template ID
    if (templateId?.startsWith('virtual-')) {
      return getVirtualTemplateById(templateId)
    }

    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'projectTaskTemplates')
    const ref = doc(db, ...segments, templateId)
    const snap = await getDoc(ref)
    return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as ProjectTaskTemplate) : null
  }

  // Apply a template to a project: generate tasks under enterpriseGroups/{groupId}/companies/{companyId}/tasks with projectId set
  static async applyTemplateToProject(companyId: string, projectId: string, projectStartDateISO: string, templateId: string, groupId?: string): Promise<string[]> {
    const template = await this.getTemplate(companyId, templateId, groupId)
    if (!template) throw new Error('Project task template not found')

    const ids: string[] = []
    const startDate = new Date(projectStartDateISO)

    for (const t of template.tasks) {
      const due = new Date(startDate)
      due.setDate(due.getDate() + (t.dueDateOffsetDays || 0))

      // Resolve effective assignee by position if available; else leave empty
      let assignedUserId = ''
      if (t.assignedPositionId) {
        const effective = await resolveEffectiveAssignment(companyId, t.assignedPositionId, groupId)
        assignedUserId = effective?.userId || ''
      }

      const taskData = {
        templateId: template.id,
        positionId: t.assignedPositionId,
        assignedUserId,
        projectId,
        title: t.title,
        description: t.description,
        category: t.category,
        priority: t.priority,
        estimatedHours: t.estimatedHours,
        dueDate: due.toISOString(),
        assignmentType: 'template_generated' as const,
        assignmentReason: `Generated from project template: ${template.name}`,
        assignedBy: 'system',
        reporter: 'system',
        status: 'assigned' as const,
        progress: 0,
        definitionOfDone: (t.definitionOfDone || []).map(d => ({
          doDItemId: d.id,
          text: d.text,
          isRequired: d.isRequired,
          isCompleted: false,
          order: d.order,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const taskSegments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
      const tasksRef = collection(db, taskSegments[0], ...taskSegments.slice(1))
      const docRef = await addDoc(tasksRef, taskData as any)
      ids.push(docRef.id)
    }


    // Update usage count only for non-virtual templates (virtual templates don't exist in Firestore)
    if (!template.id.startsWith('virtual-')) {
      await this.updateTemplate(companyId, template.id, { usageCount: (template.usageCount || 0) + 1 }, groupId)
    }

    return ids
  }
}


