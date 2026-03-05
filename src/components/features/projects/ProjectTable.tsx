import * as React from "react"
import { EnhancedProject } from "@/types/project-schema"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ActionMenu, createViewAction, createEditAction, createDeleteAction } from "@/components/ui/action-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import {
  Calendar,
  DollarSign,
  Users,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye
} from "lucide-react"
import { StarButton } from "@/components/ui/star-button"
import { useStarredItems } from "@/hooks/useStarredItems"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/date-utils"

export interface ProjectTableProps {
  projects: EnhancedProject[]
  onEdit?: (project: EnhancedProject) => void
  onDelete?: (project: EnhancedProject) => void
  onView?: (project: EnhancedProject) => void
  className?: string
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-primary/10 text-primary border-primary/20'
    case 'planning':
      return 'bg-warning/10 text-warning border-warning/20'
    case 'on-hold':
      return 'bg-muted/10 text-muted-foreground border-muted/20'
    case 'completed':
      return 'bg-success/10 text-success border-success/20'
    case 'cancelled':
      return 'bg-destructive/10 text-destructive border-destructive/20'
    default:
      return 'bg-muted/10 text-muted-foreground border-muted/20'
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'bg-destructive/10 text-destructive border-destructive/20'
    case 'high':
      return 'bg-warning/10 text-warning border-warning/20'
    case 'medium':
      return 'bg-primary/10 text-primary border-primary/20'
    case 'low':
      return 'bg-muted/10 text-muted-foreground border-muted/20'
    default:
      return 'bg-muted/10 text-muted-foreground border-muted/20'
  }
}

export const ProjectTable: React.FC<ProjectTableProps> = ({
  projects,
  onEdit,
  onDelete,
  onView,
  className
}) => {
  const { isStarred, toggleStarred } = useStarredItems()
  return (
    <div className={cn("w-full", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Team Size</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead className="w-[50px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.id} className="hover:bg-muted/50">
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <StarButton
                    isStarred={isStarred('project', project.id)}
                    onToggle={() => toggleStarred('project', project.id)}
                    size="sm"
                  />
                  <div>
                    <div className="clickable-text font-semibold">{project.name}</div>
                    <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {project.description}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={getStatusColor(project.status)}>
                  {project.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={getPriorityColor(project.priority)}>
                  {project.priority}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{Array.isArray(project.team) ? project.team.length : 0}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {project.startDate ? formatDate(project.startDate) : 'N/A'}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {onView && (
                    <ActionMenu
                      items={[
                        createViewAction(() => onView(project)),
                        createEditAction(() => onEdit?.(project)),
                        createDeleteAction(() => onDelete?.(project))
                      ]}
                      size="sm"
                    />
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
