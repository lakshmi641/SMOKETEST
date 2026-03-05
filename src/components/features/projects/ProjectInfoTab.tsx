'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EnhancedProject } from '@/types/project-schema'
import { ProjectCustomFieldWithDefinition, CustomFieldValue } from '@/types/custom-field'
import {
    Edit,
    Trash2,
    Calendar,
    Globe,
    Building2,
    X,
    Search,
    Loader2,
    Tag,
    Clock,
    User,
    ExternalLink,
    AlertCircle,
    CheckCircle2,
    Plus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/utils/date-utils'
import { toTitleCase } from '@/lib/utils/string-utils'



interface ProjectInfoTabProps {
    project: EnhancedProject
    projectUsers?: Array<{ id: string; name: string }>
    projectFields?: ProjectCustomFieldWithDefinition[]
    workspaceName?: string
    onUpdateField?: (fieldId: string, value: CustomFieldValue) => Promise<void>
    onRemoveField?: (fieldId: string) => Promise<void>
    onAddField?: () => void
    onUpdateProject?: (updates: Partial<EnhancedProject>) => Promise<void>
    userRole?: string
    isProjectManager?: boolean
    isWorkspaceOwner?: boolean
    isProjectCreator?: boolean
    workspaceMembers?: string[]
}

// Removed local formatDate to use centralized utility from date-utils

export function ProjectInfoTab({
    project,
    projectUsers = [],
    projectFields = [],
    workspaceName = 'Default',
    onUpdateField,
    onRemoveField,
    onAddField,
    onUpdateProject,
    userRole = 'employee',
    isProjectManager = false,
    isWorkspaceOwner = false,
    isProjectCreator = false,
    workspaceMembers
}: ProjectInfoTabProps) {
    const isAdmin = userRole === 'admin' || userRole === 'owner'
    // Allow editing if user is admin, project manager, workspace owner, or project creator
    const canEditGeneralInfo = isAdmin || isProjectManager || isWorkspaceOwner || isProjectCreator
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
    const [memberSearch, setMemberSearch] = useState('')
    const [isUpdatingTeam, setIsUpdatingTeam] = useState(false)
    const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
    const [editValue, setEditValue] = useState<string>('')

    const manager = projectUsers.find(u => u.id === project.manager)
    const teamMembers = projectUsers.filter(u => project.team?.includes(u.id))
    const nonTeamUsers = projectUsers.filter(u =>
        (!workspaceMembers || workspaceMembers.includes(u.id)) &&
        !project.team?.includes(u.id) &&
        u.id !== project.manager &&
        (u.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
            (u as any).email?.toLowerCase().includes(memberSearch.toLowerCase()))
    )

    const getUserName = (userId: string) => {
        const user = projectUsers.find(u => u.id === userId)
        return user?.name || userId || 'System'
    }

    const renderFieldValue = (field: ProjectCustomFieldWithDefinition) => {
        const projectValue = project.customFields?.[field.id]
        const value = (projectValue !== undefined && projectValue !== null && projectValue !== '')
            ? projectValue
            : field.definition.value

        if (value === undefined || value === null || value === '') return <span className="text-muted-foreground italic text-sm">Not set</span>

        if (field.definition.type === 'file') {
            return (
                <div className="flex items-center gap-2 text-primary hover:underline cursor-pointer text-sm font-medium">
                    <ExternalLink className="h-3 w-3" />
                    View Document
                </div>
            )
        }

        if (field.definition.type === 'date') return <span className="text-sm">{formatDate(value as string)}</span>

        if (field.definition.type === 'number') {
            const format = field.definition.format
            if (format === 'currency') return <span className="text-sm font-semibold text-green-700">₹ {Number(value).toLocaleString()}</span>
            if (format === 'percent') return <span className="text-sm">{value}%</span>
            return <span className="text-sm">{value} {field.definition.units || field.definition.customLabel}</span>
        }

        return (
            <div className="flex items-center gap-1.5">
                <span className="text-sm">{String(value)}</span>
                {field.definition.units && (
                    <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        {field.definition.units}
                    </span>
                )}
            </div>
        )
    }

    const handleUpdateFieldValue = async () => {
        if (!editingFieldId) return
        try {
            // Get the field definition to determine the type
            const field = projectFields.find(f => f.id === editingFieldId)
            let valueToSave: any = editValue

            // Convert value based on field type
            if (field?.definition.type === 'number') {
                // Convert to number for number fields
                const num = parseFloat(editValue)
                valueToSave = isNaN(num) ? null : num
            } else if (editValue.trim() === '') {
                // Empty string becomes null
                valueToSave = null
            }

            await onUpdateField?.(editingFieldId, valueToSave)
            toast.success('Field updated')
            setEditingFieldId(null)
        } catch (error) {
            console.error('Error updating field:', error)
            toast.error('Failed to update field')
        }
    }

    const handleRemoveField = async (fieldId: string, fieldName: string) => {
        if (confirm(`Are you sure you want to remove the field "${fieldName}" from this project?`)) {
            try {
                await onRemoveField?.(fieldId)
            } catch (error) {
                console.error('Error removing field:', error)
            }
        }
    }

    const handleAddMember = async (userId: string) => {
        try {
            setIsUpdatingTeam(true)
            const newTeam = [...(project.team || []), userId]
            await onUpdateProject?.({ team: newTeam })
            toast.success('Member added successfully')
        } catch (error) {
            console.error('Error adding member:', error)
            toast.error('Failed to add member')
        } finally {
            setIsUpdatingTeam(false)
        }
    }

    const handleRemoveMember = async (userId: string) => {
        try {
            setIsUpdatingTeam(true)
            const newTeam = (project.team || []).filter(id => id !== userId)
            await onUpdateProject?.({ team: newTeam })
            toast.success('Member removed successfully')
        } catch (error) {
            console.error('Error removing member:', error)
            toast.error('Failed to remove member')
        } finally {
            setIsUpdatingTeam(false)
        }
    }

    const renderVerificationBadge = (fieldId: string) => {
        const status = project.verificationStatus?.[fieldId]
        if (!status) return null

        switch (status) {
            case 'verified':
                return <CheckCircle2 className="h-3 w-3 text-green-500" />
            case 'rejected':
                return <AlertCircle className="h-3 w-3 text-red-500" />
            case 'pending':
                return <Clock className="h-3 w-3 text-orange-400" />
            default:
                return null
        }
    }

    return (
        <div className="space-y-6 w-full pb-6">
            {/* 1. Project Header Section */}
            <div className="bg-white dark:bg-slate-900 border rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 flex flex-col md:flex-row gap-6 items-start justify-between">
                    <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white group flex items-center gap-2">
                                {project.name}
                                {canEditGeneralInfo && <Edit className="h-4 w-4 opacity-0 group-hover:opacity-100 cursor-pointer text-slate-400" />}
                            </h1>
                            <div className="flex items-center gap-2">
                                <Badge variant={project.status === 'active' ? 'default' : 'outline'} className="h-fit py-1 px-3 bg-green-500 hover:bg-green-600 text-white border-0 font-bold">
                                    {project.status.toUpperCase()}
                                </Badge>
                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/50 text-xs font-medium text-muted-foreground border border-border">
                                    <Globe className="h-3 w-3" />
                                    STANDARD
                                </div>
                            </div>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 max-w-2xl text-sm leading-relaxed">
                            {project.description || 'Provide a high-level summary of the project goals and scope.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <div className="px-3 py-2 rounded-lg border border-border bg-muted/50 flex flex-col items-center min-w-[100px]">
                            <span className="text-xs font-medium text-muted-foreground mb-1">Project ID</span>
                            <span className="text-sm font-bold text-foreground">{project.projectCode || 'PRJ-' + project.id.slice(0, 5).toUpperCase()}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* 2. Project Details (Creation Data) */}
                    <Card className="border-slate-100 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="px-6 pt-6 pb-2 space-y-1">
                            <CardTitle className="text-xl font-semibold tracking-tight text-foreground">Creation details</CardTitle>
                            <p className="text-sm text-muted-foreground">Basic information about the project creation.</p>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold tracking-tight text-foreground">Workspace</p>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                        {workspaceName}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold tracking-tight text-foreground">Created by</p>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                            {getUserName(project.createdBy || '').charAt(0).toUpperCase()}
                                        </div>
                                        {toTitleCase(getUserName(project.createdBy || ''))}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold tracking-tight text-foreground">Created on</p>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                        {formatDate(project.createdAt)}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold tracking-tight text-foreground">Timeline</p>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                        {formatDate(project.startDate)}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 3. Additional Information (Custom Fields) */}
                    <Card className="border-slate-100 shadow-sm bg-white">
                        <CardHeader className="px-6 pt-6 pb-2 space-y-1 border-b-0">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
                                        Additional information
                                    </CardTitle>
                                    <p className="text-sm text-muted-foreground mt-1">Custom fields and extra project data.</p>
                                </div>
                                {canEditGeneralInfo && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs font-bold text-primary hover:bg-primary/5 px-3"
                                        onClick={onAddField}
                                    >
                                        <Plus className="h-3 w-3 mr-1" /> ADD FIELD
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                                {projectFields.length > 0 ? (
                                    projectFields.map((field: ProjectCustomFieldWithDefinition) => (
                                        <div key={field.id} className="space-y-2 group">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <label className="text-sm font-semibold tracking-tight text-foreground">{field.definition.name}</label>
                                                    {renderVerificationBadge(field.id)}
                                                </div>
                                                {canEditGeneralInfo && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                        <button
                                                            className="text-slate-300 hover:text-primary p-1"
                                                            onClick={() => {
                                                                setEditingFieldId(field.id)
                                                                setEditValue(String(project.customFields?.[field.id] || ''))
                                                            }}
                                                        >
                                                            <Edit className="h-3 w-3" />
                                                        </button>
                                                        <button
                                                            className="text-slate-300 hover:text-red-500 p-1"
                                                            onClick={() => handleRemoveField(field.id, field.definition.name)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="px-4 py-3 bg-muted/30 border border-border rounded-xl group-hover:border-primary/20 transition-all group-hover:bg-card group-hover:shadow-sm min-h-[44px] flex items-center text-foreground">
                                                {renderFieldValue(field)}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-2 py-10 text-center">
                                        <p className="text-sm text-slate-400 italic">No additional information fields defined.</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    {/* Team & Stakeholders Card */}
                    <Card className="border-slate-100 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="px-6 pt-6 pb-2 space-y-1 bg-transparent border-b-0">
                            <CardTitle className="text-xl font-semibold tracking-tight text-foreground">Team & stakeholders</CardTitle>
                            <p className="text-sm text-muted-foreground">People involved in this project.</p>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold tracking-tight text-foreground">Project Manager</label>
                                <div className="flex items-center gap-4 p-3 rounded-xl border border-border bg-muted/30 group cursor-pointer hover:bg-card hover:shadow-md transition-all">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                                        {manager?.name?.charAt(0) || <User className="h-5 w-5" />}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">{toTitleCase(manager?.name || 'Unassigned')}</p>
                                        <p className="text-xs text-muted-foreground">Core Lead</p>
                                    </div>
                                    {canEditGeneralInfo && <Edit className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />}
                                </div>
                            </div>

                            <div className="space-y-3 pt-4 border-t border-border">
                                <div className="flex items-center justify-between text-sm font-semibold tracking-tight text-foreground">
                                    <span>Team Members</span>
                                    <Badge variant="secondary" className="text-xs h-4 py-0">{teamMembers.length}</Badge>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-2">
                                        {teamMembers.map((user) => (
                                            <div key={user.id} className="group relative flex items-center gap-2 p-1.5 pr-3 rounded-full border border-border bg-muted/30 hover:bg-card hover:shadow-sm transition-all">
                                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-xs font-semibold tracking-tight text-foreground">{toTitleCase(user.name)}</span>
                                                {canEditGeneralInfo && (
                                                    <button
                                                        onClick={() => handleRemoveMember(user.id)}
                                                        className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {teamMembers.length === 0 && (
                                            <p className="text-[10px] text-slate-400 italic py-2">No team members assigned</p>
                                        )}
                                    </div>
                                    {canEditGeneralInfo && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full h-8 text-xs font-bold border-dashed border-slate-200 text-slate-400 hover:text-primary hover:border-primary/50 transition-all"
                                            onClick={() => setIsAddMemberOpen(true)}
                                        >
                                            <Plus className="h-3 w-3 mr-1" /> ADD TEAM MEMBER
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Add Member Dialog */}
            <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-bold uppercase tracking-widest text-slate-500">Add Team Member</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search members..."
                                className="pl-10 h-10 text-sm"
                                value={memberSearch}
                                onChange={(e) => setMemberSearch(e.target.value)}
                            />
                        </div>
                        <ScrollArea className="h-72 pr-4">
                            <div className="space-y-1">
                                {nonTeamUsers.map((user) => (
                                    <div
                                        key={user.id}
                                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all cursor-pointer group"
                                        onClick={() => handleAddMember(user.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-700">{toTitleCase(user.name)}</p>
                                                <p className="text-[10px] text-slate-400">{(user as any).email || 'No email'}</p>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                                            {isUpdatingTeam ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Field Value Dialog */}
            <Dialog open={!!editingFieldId} onOpenChange={(open) => !open && setEditingFieldId(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-bold uppercase tracking-widest text-slate-500">Edit Field Value</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                            {projectFields.find((f: ProjectCustomFieldWithDefinition) => f.id === editingFieldId)?.definition.name}
                        </Label>
                        <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-10"
                            placeholder="Enter new value..."
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" size="sm" onClick={() => setEditingFieldId(null)} className="text-xs font-bold">CANCEL</Button>
                        <Button size="sm" onClick={handleUpdateFieldValue} className="text-xs font-bold bg-primary text-white hover:bg-primary/90">SAVE CHANGES</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
