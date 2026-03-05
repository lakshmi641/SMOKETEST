'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProjectCreationWizard } from '@/components/features/projects'
import {
  Position,
  WorkflowTemplate,
  ComplianceRequirement
} from '@/types/prd-aligned-schema'
import { EnhancedProject } from '@/types/project-schema'
import { ProjectService } from '@/lib/services'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

export default function EditProjectPage() {
  const router = useRouter()
  const params = useParams()
  const { companyId, groupId, currentCompanyUser } = useCompany()
  const { user: currentUser } = useAuthStore()
  const projectId = params.projectId as string
  const [project, setProject] = useState<EnhancedProject | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([])
  const [complianceRequirements, setComplianceRequirements] = useState<ComplianceRequirement[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (!companyId || !projectId) return

      try {
        setIsLoading(true)

        // Load project data with privacy checking
        const userId = currentUser?.id
        const isGlobalAdmin = currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'
        const projectData = await ProjectService.getProject(companyId, projectId, userId, isGlobalAdmin, { groupId: groupId ?? undefined })
        if (!projectData) {
          toast.error('Project not found or you do not have access to this project')
          router.push('/projects')
          return
        }
        setProject(projectData)

        // Mock data for demo - in real implementation, this would come from Firebase
        const mockPositions: Position[] = [
          {
            id: 'pos-1',
            title: 'Manufacturing Manager',
            designation: 'Manager',
            department: 'Manufacturing',
            level: 2,
            managerPositionId: 'pos-ceo',
            directReports: ['pos-engineer-1', 'pos-engineer-2'],
            matrixReports: [],
            skills: ['Project Management', 'Team Leadership', 'Quality Control'],
            responsibilities: ['Oversee manufacturing operations', 'Manage production schedules'],
            isActive: true,
            effectiveStartDate: '2024-01-01',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          },
          {
            id: 'pos-2',
            title: 'Senior Manufacturing Engineer',
            designation: 'Engineer',
            department: 'Engineering',
            level: 3,
            managerPositionId: 'pos-1',
            directReports: [],
            matrixReports: ['pos-quality-manager'],
            skills: ['CAD Design', 'Manufacturing Processes', 'Quality Assurance'],
            responsibilities: ['Design manufacturing systems', 'Implement quality controls'],
            isActive: true,
            effectiveStartDate: '2024-01-01',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          },
          {
            id: 'pos-3',
            title: 'Quality Manager',
            designation: 'Manager',
            department: 'Quality Assurance',
            level: 2,
            managerPositionId: 'pos-ceo',
            directReports: [],
            matrixReports: ['pos-2'],
            skills: ['Quality Control', 'ISO Standards', 'Compliance'],
            responsibilities: ['Ensure quality standards', 'Manage compliance'],
            isActive: true,
            effectiveStartDate: '2024-01-01',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ]

        const mockTemplates: WorkflowTemplate[] = [
          {
            id: 'template-1',
            name: 'Manufacturing Project Template',
            description: 'Standard template for manufacturing projects with quality gates',
            category: 'project',
            industry: ['Manufacturing'],
            department: ['Manufacturing', 'Engineering'],
            positionLevel: [2, 3],
            steps: [
              {
                id: 'step-1',
                name: 'Project Planning',
                description: 'Initial project planning and resource allocation',
                stepType: 'task',
                assignedPositionId: 'pos-1',
                routingRules: [],
                dependencies: [],
                estimatedHours: 40,
                definitionOfDone: [
                  {
                    id: 'dod-1',
                    text: 'Project charter approved',
                    isRequired: true,
                    evidenceType: 'approval',
                    validationRules: []
                  }
                ],
                isRequired: true,
                order: 1
              }
            ],
            approvalMatrix: {
              id: 'approval-1',
              name: 'Standard Project Approval',
              type: 'sequential',
              approvers: [
                {
                  id: 'level-1',
                  level: 1,
                  positionIds: ['pos-1'],
                  requiredApprovals: 1,
                  canDelegate: true,
                  timeoutHours: 24
                }
              ],
              escalationPolicy: {
                id: 'escalation-1',
                name: 'Standard Escalation',
                escalationSteps: [],
                maxEscalations: 2
              },
              timeoutHours: 72
            },
            complianceRequirements: [
              {
                id: 'comp-1',
                regulation: 'ISO 9001',
                region: 'Global',
                industry: 'Manufacturing',
                requirement: 'Quality management system compliance',
                deadlineType: 'relative',
                deadlineValue: '30 days',
                evidenceRequired: ['Quality audit report'],
                auditTrailRequired: true
              }
            ],
            estimatedDuration: 90,
            isActive: true,
            createdBy: 'admin',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ]

        const mockCompliance: ComplianceRequirement[] = [
          {
            id: 'comp-sox',
            regulation: 'SOX',
            region: 'US',
            industry: 'Financial Services',
            requirement: 'Financial reporting controls',
            deadlineType: 'absolute',
            deadlineValue: '2024-12-31',
            evidenceRequired: ['Audit report', 'Control documentation'],
            auditTrailRequired: true
          },
          {
            id: 'comp-gdpr',
            regulation: 'GDPR',
            region: 'EU',
            industry: 'All',
            requirement: 'Data protection compliance',
            deadlineType: 'absolute',
            deadlineValue: '2024-12-31',
            evidenceRequired: ['Privacy impact assessment', 'Data processing agreement'],
            auditTrailRequired: true
          }
        ]

        setPositions(mockPositions)
        setWorkflowTemplates(mockTemplates)
        setComplianceRequirements(mockCompliance)
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('Failed to load project data')
        router.push('/projects')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [companyId, projectId, router])

  const handleProjectUpdated = async (updatedProject: EnhancedProject) => {
    if (!companyId || !projectId) return

    try {
      await ProjectService.updateProject(companyId, projectId, {
        name: updatedProject.name,
        description: updatedProject.description,
        status: updatedProject.status,
        priority: updatedProject.priority,
        manager: updatedProject.manager,
        team: updatedProject.team,
        startDate: updatedProject.startDate,
        endDate: updatedProject.endDate,
        progress: updatedProject.progress,
        tags: updatedProject.tags,
        equipmentType: updatedProject.equipmentType,
        manufacturingPhase: updatedProject.manufacturingPhase,
        qualityStandards: updatedProject.qualityStandards,
        complianceRequirements: updatedProject.complianceRequirements,
        templateId: updatedProject.templateId || null,
        projectCode: updatedProject.projectCode,
        department: updatedProject.department,
        client: updatedProject.client || null,
        location: updatedProject.location,
        requiresApproval: updatedProject.requiresApproval,
        approvedBy: updatedProject.approvedBy,
        approvedAt: updatedProject.approvedAt,
        approvalNotes: updatedProject.approvalNotes,
        lastActivityDate: new Date().toISOString(),
      }, { groupId: groupId ?? undefined })

      toast.success(`Project "${updatedProject.name}" updated successfully!`)
      router.push(`/projects/${projectId}`)
    } catch (error) {
      console.error('Error updating project:', error)
      toast.error('Failed to update project')
    }
  }

  const handleCancel = () => {
    router.push(`/projects/${projectId}`)
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading project...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!currentUser || !project) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600">Please log in to edit projects.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // Pre-fill form with project data
  const initialFormData = {
    name: project.name || '',
    description: project.description || '',
    projectCode: project.projectCode || '',
    status: project.status || 'planning',
    priority: project.priority || 'medium',
    assignedPositionId: '', // Would need to be resolved from manager/team
    assignedUserId: project.manager || '',
    matrixPositions: project.team || [], // Use team as matrix positions
    startDate: project.startDate || '',
    endDate: project.endDate || '',
    estimatedDuration: 0,
    costCategory: 'Operating Expense', // Not in EnhancedProject schema
    department: project.department || '',
    businessUnit: '', // Not in EnhancedProject schema
    costCenter: '', // Not in EnhancedProject schema
    location: project.location || '',
    equipmentType: project.equipmentType || 'other',
    manufacturingPhase: project.manufacturingPhase || 'Design & Engineering',
    qualityStandards: project.qualityStandards || [],
    workflowTemplateId: project.templateId || '',
    complianceRequirements: project.complianceRequirements || [],
    requiresApproval: project.requiresApproval !== undefined ? project.requiresApproval : true,
    approvalMatrixId: '', // Not directly stored
    definitionOfDone: [], // Not directly stored
    tags: project.tags || [],
    client: project.client || ''
  }

  const handleFormSubmit = async (formData: any) => {
    if (!companyId) return

    try {
      await ProjectService.updateProject(companyId, projectId, {
        name: formData.name,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        manager: formData.assignedUserId || null,
        team: formData.matrixPositions || [],
        startDate: formData.startDate,
        endDate: formData.endDate,
        tags: formData.tags || [],
        equipmentType: formData.equipmentType || 'other',
        manufacturingPhase: formData.manufacturingPhase || 'Design & Engineering',
        qualityStandards: formData.qualityStandards || [],
        complianceRequirements: formData.complianceRequirements || [],
        templateId: formData.workflowTemplateId || null,
        projectCode: formData.projectCode,
        department: formData.department,
        client: formData.client || null,
        location: formData.location,
        requiresApproval: formData.requiresApproval,
        lastActivityDate: new Date().toISOString(),
      }, { groupId: groupId ?? undefined })

      toast.success('Project updated successfully!')
      const userId = currentUser?.id
      const isGlobalAdmin = currentCompanyUser?.role === 'owner' || currentCompanyUser?.role === 'admin'
      const updated = await ProjectService.getProject(companyId, projectId, userId, isGlobalAdmin, { groupId: groupId ?? undefined })
      if (updated && handleProjectUpdated) {
        handleProjectUpdated(updated)
      } else {
        router.push(`/projects/${projectId}`)
      }
    } catch (error) {
      console.error('Error updating project:', error)
      toast.error('Failed to update project')
    }
  }

  return (
    <DashboardLayout>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Edit Project</h1>
          <p className="text-gray-600 mt-1">Update project details, templates, and settings</p>
        </div>
        <ProjectCreationWizard
          initialValues={initialFormData}
          mode="edit"
          projectId={projectId}
          onProjectCreated={handleFormSubmit}
          onCancel={handleCancel}
          currentUser={currentUser}
          positions={positions}
          workflowTemplates={workflowTemplates}
          complianceRequirements={complianceRequirements}
        />
      </div>
    </DashboardLayout>
  )
}

