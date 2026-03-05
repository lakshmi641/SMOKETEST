import * as React from "react"
import { StarButton } from "@/components/ui/star-button"
import { useStarredItems } from "@/hooks/useStarredItems"
import { EnhancedProject } from "@/types/project-schema"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Calendar,
  DollarSign,
  Users,
  Edit,
  Trash2,
  Eye,
  FolderKanban
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/date-utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Workspace } from "@/types/workspace-schema"

export interface VirtualizedProjectTableProps {
  projects: EnhancedProject[]
  workspaces?: Workspace[]
  onEdit?: (project: EnhancedProject) => void
  onDelete?: (project: EnhancedProject) => void
  onView?: (project: EnhancedProject) => void
  className?: string
  height?: number
  loading?: boolean
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800'
    case 'planning':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800'
    case 'on-hold':
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
    case 'completed':
      return 'bg-muted text-muted-foreground border-border'
    case 'cancelled':
      return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800'
    case 'high':
      return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 border-orange-200 dark:border-orange-800'
    case 'medium':
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
    case 'low':
      return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

export const VirtualizedProjectTable: React.FC<VirtualizedProjectTableProps> = ({
  projects,
  workspaces = [],
  onEdit,
  onDelete,
  onView,
  className,
  height = 500,
  loading = false
}) => {
  const { isStarred, toggleStarred } = useStarredItems()

  if (loading) {
    return (
      <div className={cn("border rounded-lg", className)}>
        <div className="flex items-center justify-center h-32 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Loading...</span>
        </div>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className={cn("border rounded-lg", className)}>
        <div className="flex items-center justify-center h-32 text-gray-500">
          No projects found
        </div>
      </div>
    )
  }

  return (
    <div className={cn("border rounded-lg overflow-hidden flex flex-col min-h-0", className)}>
      <div
        className="overflow-auto min-h-0"
        style={{ maxHeight: typeof height === 'number' ? `${height}px` : undefined }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[280px] w-[30%]">Project Name</TableHead>
              <TableHead className="min-w-[160px]">Workspace</TableHead>
              <TableHead className="min-w-[100px]">Status</TableHead>
              <TableHead className="min-w-[100px]">Priority</TableHead>
              <TableHead className="min-w-[90px]">Team Size</TableHead>
              <TableHead className="min-w-[110px]">Start Date</TableHead>
              <TableHead className="min-w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow
                key={project.id}
                className={cn(
                  "clickable-row",
                  !onView && "hover:bg-muted/50"
                )}
                onClick={() => onView?.(project)}
              >
                <TableCell className="align-top">
                  <div className="flex items-start gap-2 min-w-0">
                    <StarButton
                      isStarred={isStarred('project', project.id)}
                      onToggle={() => toggleStarred('project', project.id)}
                      size="sm"
                      className="shrink-0 mt-0.5"
                    />
                    <div onClick={(e) => e.stopPropagation()} className="min-w-0">
                      <div className="clickable-text font-semibold break-words">{project.name}</div>
                      {project.description && (
                        <div className="text-sm text-gray-500 break-words mt-0.5">
                          {project.description}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()} className="align-top min-w-[160px]">
                  {project.workspaceId ? (
                    (() => {
                      const workspace = workspaces.find(w => w.id === project.workspaceId)
                      return workspace ? (
                        <div className="flex items-center gap-2 min-w-0">
                          {workspace.color && (
                            <div
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: workspace.color }}
                            />
                          )}
                          <span className="text-sm text-muted-foreground break-words">
                            {workspace.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )
                    })()
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Badge variant="outline" className={getStatusColor(project.status)}>
                    {project.status}
                  </Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Badge variant="outline" className={getPriorityColor(project.priority)}>
                    {project.priority}
                  </Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">
                      {project.team?.length || 0}
                    </span>
                  </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">
                      {project.startDate ? formatDate(project.startDate) : 'N/A'}
                    </span>
                  </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    {onView && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onView(project)
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEdit(project)
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(project)
                        }}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
