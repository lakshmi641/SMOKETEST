'use client'

import { ChevronLeft } from 'lucide-react'
import { formatTaskId } from '@/lib/utils/task-display'
import type { GeneratedTask } from '@/types/task-template-schema'
import { cn } from '@/lib/utils'

interface TaskBreadcrumbProps {
    task: GeneratedTask
    parentTask?: GeneratedTask | null
    project?: { projectCode?: string; name?: string } | null
    companyId?: string | null
    companyDomain?: string | null
    onBack?: () => void
    onNavigateToParent?: () => void
}

/**
 * TaskBreadcrumb - Display hierarchical navigation for tasks
 * Styled to match premium lozenge appearance.
 */
export function TaskBreadcrumb({
    task,
    parentTask,
    project,
    companyId,
    companyDomain,
    onBack,
    onNavigateToParent
}: TaskBreadcrumbProps) {
    const isSubtask = !!task.parentTaskId && !!parentTask
    const projectCode = project?.projectCode || task.projectCode || project?.name?.substring(0, 4).toUpperCase() || 'TASK'
    const displayId = formatTaskId(task, project, companyId, companyDomain)

    const handleBack = () => {
        if (onBack) {
            onBack()
        } else {
            window.history.back()
        }
    }

    const Badge = ({ children, onClick, active, className }: { children: React.ReactNode, onClick?: () => void, active?: boolean, className?: string }) => (
        <button
            onClick={onClick}
            disabled={!onClick}
            className={cn(
                "px-3 py-1 rounded-full text-[11px] font-bold tracking-tight transition-all border",
                onClick
                    ? "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 cursor-pointer shadow-sm"
                    : "bg-white border-slate-200 text-slate-800 cursor-default shadow-sm",
                className
            )}
        >
            {children}
        </button>
    )

    return (
        <div className="flex items-center gap-4 text-sm">
            {/* Minimalist Back Arrow */}
            <button
                onClick={handleBack}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
                title="Go back"
            >
                <ChevronLeft className="h-5 w-5" />
            </button>

            {/* Breadcrumb Path */}
            <div className="flex items-center gap-1 sm:gap-2 overflow-hidden">
                {/* Always show Project Code first */}
                <Badge className="hidden xs:inline-flex">{projectCode}</Badge>

                {/* Separator and task IDs - hidden for autocracy tenant */}
                {displayId ? (
                    <>
                        <span className="hidden xs:inline text-slate-300 font-light px-0.5">/</span>
                        {isSubtask ? (
                            <>
                                {/* Parent Task ID (Clickable) */}
                                <Badge onClick={onNavigateToParent}>
                                    {formatTaskId(parentTask!, project, companyId, companyDomain)}
                                </Badge>

                                {/* Separator */}
                                <span className="text-slate-300 font-light px-0.5">/</span>

                                {/* Current Subtask ID */}
                                <Badge>{displayId}</Badge>
                            </>
                        ) : (
                            <Badge>{displayId}</Badge>
                        )}
                    </>
                ) : null}
            </div>
        </div>
    )
}
