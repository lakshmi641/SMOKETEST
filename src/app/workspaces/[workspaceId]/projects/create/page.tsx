'use client'

import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProjectCreationWizard } from '@/components/features/projects/ProjectCreationWizard'
import { useCompany } from '@/contexts/CompanyContext'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useState, useEffect } from 'react'
import { getPositions } from '@/lib/services/org/org-services'
import type { Position as OrgPosition } from '@/types/org-schema'
import type { Position as PRDPosition, WorkflowTemplate, ComplianceRequirement } from '@/types/prd-aligned-schema'
import toast from 'react-hot-toast'

export default function CreateProjectPage() {
  const params = useParams()
  const router = useRouter()
  const { companyId, groupId } = useCompany()
  const { selectedWorkspace } = useWorkspace()
  const workspaceId = params.workspaceId as string

  const [positions, setPositions] = useState<PRDPosition[]>([])
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([])
  const [complianceRequirements, setComplianceRequirements] = useState<ComplianceRequirement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (!companyId) return

      try {
        setLoading(true)
        // Load positions and convert from org-schema to prd-aligned-schema
        const orgPositions = await getPositions(companyId, groupId ?? undefined)
        const prdPositions: PRDPosition[] = orgPositions.map(p => ({
          id: p.id,
          title: p.title,
          designation: p.title, // Fallback to title as designation is missing in OrgPosition
          department: p.orgUnitId || '',
          level: p.level,
          managerPositionId: p.reportsToPositionId || undefined,
          directReports: [],
          matrixReports: [],
          skills: p.requiredSkills || [],
          responsibilities: p.responsibilities || [],
          isActive: p.status === 'active',
          effectiveStartDate: p.createdAt,
          effectiveEndDate: undefined,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }))
        setPositions(prdPositions)
        // Default empty arrays for now - can be populated when services are available
        setWorkflowTemplates([])
        setComplianceRequirements([])
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('Failed to load form data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [companyId])

  const handleProjectCreated = async (project: any) => {
    router.push(`/workspaces/${workspaceId}/projects/${project.id}`)
  }

  const handleCancel = () => {
    router.push(`/workspaces/${workspaceId}/projects`)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl">
        <ProjectCreationWizard
          initialValues={{
            workspaceId: workspaceId, // Pre-fill workspace
          }}
          onProjectCreated={handleProjectCreated}
          onCancel={handleCancel}
          currentUser={{ id: 'current-user', department: '' }}
          positions={positions}
          workflowTemplates={workflowTemplates}
          complianceRequirements={complianceRequirements}
        />
      </div>
    </DashboardLayout>
  )
}

