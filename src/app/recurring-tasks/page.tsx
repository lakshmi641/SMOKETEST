'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { RecurringTaskList } from '@/components/features/recurring-tasks/RecurringTaskList'
import { RecurringTaskDialog } from '@/components/features/recurring-tasks/RecurringTaskDialog'
import * as RecurringTaskService from '@/lib/services/recurring-tasks/recurring-task-service'
import { UserService } from '@/lib/services/users/user-services'
import { getPositions, getOrgUnits } from '@/lib/services/org/org-services'
import { WorkspaceService } from '@/lib/services'
import type { WorkspaceRecurringConfig, TaskAssignment } from '@/types/recurring-task-schema'
import type { Workspace } from '@/types/workspace-schema'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'
import toast from 'react-hot-toast'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, FileSpreadsheet } from 'lucide-react'
import { ImportWizard } from '@/components/import/ImportWizard'

export default function GlobalRecurringTasksPage() {
    const router = useRouter()
    const { companyId, groupId, currentCompanyUser } = useCompany()
    const { user: currentUser } = useAuthStore()

    const [recurringConfigs, setRecurringConfigs] = useState<WorkspaceRecurringConfig[]>([])
    const [workspaces, setWorkspaces] = useState<Workspace[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [recurringDialog, setRecurringDialog] = useState<{
        open: boolean
        config: Partial<WorkspaceRecurringConfig> | null
    }>({ open: false, config: null })

    const [companyUsers, setCompanyUsers] = useState<{ id: string; name: string }[]>([])
    const [companyPositions, setCompanyPositions] = useState<any[]>([])
    const [orgUnits, setOrgUnits] = useState<{ id: string; name: string }[]>([])
    const [importWizardOpen, setImportWizardOpen] = useState(false)

    useEffect(() => {
        const loadAllData = async () => {
            if (!companyId || !currentUser) return

            try {
                setLoading(true)
                setError(null)

                // Only admins can view global list
                if (currentCompanyUser?.role !== 'owner' && currentCompanyUser?.role !== 'admin') {
                    setError('Only company administrators can view the global recurring tasks list.')
                    setLoading(false)
                    return
                }

                const [users, positions, allWorkspaces, orgUnitsList] = await Promise.all([
                    UserService.getUsers(companyId, groupId ?? undefined),
                    getPositions(companyId, groupId ?? undefined),
                    WorkspaceService.getWorkspaces(companyId),
                    getOrgUnits(companyId, groupId ?? undefined)
                ])

                // Resolve position title for assignee matching (user.position may be ID or title)
                const usersWithPositionTitle = users.map((u) => {
                    const pos = positions.find((p) => p.id === u.position)
                    const positionTitle = pos ? pos.title : (u.position || '')
                    return { ...u, position: positionTitle, positionName: positionTitle }
                })
                setCompanyUsers(usersWithPositionTitle)
                setCompanyPositions(positions)
                setWorkspaces(allWorkspaces)
                setOrgUnits(orgUnitsList.map(d => ({ id: d.id, name: d.name })))
            } catch (err: any) {
                console.error('Error loading global recurring tasks:', err)
                setError(err.message || 'Failed to load static data')
            } finally {
                setLoading(false)
            }
        }

        loadAllData()
    }, [companyId, currentUser, currentCompanyUser])

    // Subscription for configs
    useEffect(() => {
        if (!companyId || !currentUser || (currentCompanyUser?.role !== 'owner' && currentCompanyUser?.role !== 'admin')) return

        const unsubscribe = RecurringTaskService.subscribeCompanyConfigs(
            companyId,
            (configs) => {
                setRecurringConfigs(configs)
                setLoading(false)
            },
            (err) => {
                setError('Failed to sync changes')
            },
            groupId || undefined
        )

        return () => unsubscribe()
    }, [companyId, currentUser, currentCompanyUser])

    const handleEditRecurring = (config: WorkspaceRecurringConfig) => {
        setRecurringDialog({ open: true, config })
    }

    const handleSaveRecurring = async (config: Partial<WorkspaceRecurringConfig>) => {
        if (!companyId || !currentUser) return

        try {
            if (recurringDialog.config?.id) {
                await RecurringTaskService.updateRecurringConfig({
                    configId: recurringDialog.config.id,
                    companyId,
                    userId: currentUser.id,
                    updates: config,
                    groupId: groupId || undefined
                })
                toast.success('Recurring task updated')
            } else {
                // Create new
                await RecurringTaskService.createRecurringConfig({
                    companyId,
                    workspaceId: config.workspaceId || '',
                    projectId: config.projectId || '',
                    taskDefinition: config.taskDefinition as WorkspaceRecurringConfig['taskDefinition'],
                    schedule: config.schedule as WorkspaceRecurringConfig['schedule'],
                    assignment: config.assignment as TaskAssignment,
                    userId: currentUser.id,
                    groupId: groupId || undefined
                })
                toast.success('Recurring task created')
            }

            setRecurringDialog({ open: false, config: null })
        } catch (error: any) {
            toast.error(error.message || 'Failed to save recurring task')
        }
    }

    const handleToggleRecurring = async (config: WorkspaceRecurringConfig) => {
        if (!companyId || !currentUser) return
        try {
            await RecurringTaskService.toggleConfigActive(config.id, companyId, currentUser.id, groupId || undefined)
            toast.success(`Task ${!config.isActive ? 'activated' : 'paused'}`)
        } catch (error) {
            toast.error('Failed to toggle status')
        }
    }

    const handleArchiveRecurring = async (config: WorkspaceRecurringConfig) => {
        if (!companyId || !currentUser) return
        try {
            await RecurringTaskService.archiveRecurringConfig(config.id, companyId, currentUser.id, groupId || undefined)
            toast.success('Task archived')
        } catch (error) {
            toast.error('Failed to archive task')
        }
    }

    const handleUnarchiveRecurring = async (config: WorkspaceRecurringConfig) => {
        if (!companyId || !currentUser) return
        try {
            await RecurringTaskService.unarchiveRecurringConfig(config.id, companyId, currentUser.id, groupId || undefined)
            toast.success('Task restored')
        } catch (error) {
            toast.error('Failed to restore task')
        }
    }

    const handleRunNow = async (config: WorkspaceRecurringConfig) => {
        if (!companyId) return
        const callManualRun = httpsCallable(functions, 'manualRunRecurringTask')
        toast.promise(
            callManualRun({ configId: config.id, companyId, groupId }),
            {
                loading: 'Generating task...',
                success: 'Task generated successfully!',
                error: 'Failed to generate task'
            }
        )
    }

    if (error) {
        return (
            <DashboardLayout>
                <div className="max-w-4xl mx-auto mt-10">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>
                            {error}
                        </AlertDescription>
                    </Alert>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <RecurringTaskList
                    configs={recurringConfigs}
                    isLoading={loading}
                    onCreateNew={() => setRecurringDialog({ open: true, config: {} })}
                    onEdit={handleEditRecurring}
                    onToggle={handleToggleRecurring}
                    onArchive={handleArchiveRecurring}
                    onUnarchive={handleUnarchiveRecurring}
                    onRunNow={handleRunNow}
                    onImport={() => setImportWizardOpen(true)}
                />
            </div>

            <ImportWizard
                isOpen={importWizardOpen}
                onClose={() => setImportWizardOpen(false)}
                importType="recurring_tasks"
                context={{
                    companyId: companyId || '',
                    projectId: '', // Optional for global recurring
                    workspaceId: '', // Optional for global recurring
                    userId: currentUser?.id || ''
                }}
            />

            {recurringDialog.open && recurringDialog.config && (
                <RecurringTaskDialog
                    open={recurringDialog.open}
                    onOpenChange={(open) => setRecurringDialog({ open, config: null })}
                    initialData={recurringDialog.config}
                    workspaceId={recurringDialog.config.workspaceId || ''}
                    companyId={companyId || ''}
                    users={companyUsers}
                    positions={companyPositions}
                    departments={orgUnits}
                    onSave={handleSaveRecurring}
                />
            )}
        </DashboardLayout>
    )
}
