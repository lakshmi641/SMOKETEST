'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Trash2, ChevronRight, ChevronLeft, Loader2, CheckCircle2 } from 'lucide-react'
import { ProjectTaskTemplateService } from '@/lib/services/projects/project-task-template-service'
import { ProjectTaskTemplate, ProjectTaskDefinition, ProjectType } from '@/types/project-task-template'
import toast from 'react-hot-toast'

interface CustomTemplateWizardProps {
    companyId: string
    groupId?: string
    initialProjectType?: ProjectType
    onClose: () => void
    onTemplateCreated: (templateId: string) => void
}

export function CustomTemplateWizard({
    companyId,
    groupId,
    initialProjectType,
    onClose,
    onTemplateCreated
}: CustomTemplateWizardProps) {
    const [step, setStep] = useState(1)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Template State
    const [templateData, setTemplateData] = useState<Omit<ProjectTaskTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'isSystemTemplate'>>({
        name: '',
        description: '',
        category: 'custom',
        projectType: initialProjectType || 'other',
        department: [],
        tags: [],
        tasks: [],
        isActive: true,
        createdBy: 'user'
    })

    const handleNext = () => {
        if (step === 1 && !templateData.name.trim()) {
            toast.error('Template name is required')
            return
        }
        if (step === 2 && templateData.tasks.length === 0) {
            toast.error('At least one task is required')
            return
        }
        setStep(prev => prev + 1)
    }

    const handleBack = () => setStep(prev => prev - 1)

    const addTask = () => {
        const newTask: ProjectTaskDefinition = {
            id: `task-${Date.now()}`,
            title: '',
            description: '',
            category: 'general',
            priority: 'medium',
            estimatedHours: 1,
            dueDateOffsetDays: 0,
            assignedPositionId: '',
            definitionOfDone: []
        }
        setTemplateData(prev => ({
            ...prev,
            tasks: [...prev.tasks, newTask]
        }))
    }

    const removeTask = (taskId: string) => {
        setTemplateData(prev => ({
            ...prev,
            tasks: prev.tasks.filter(t => t.id !== taskId)
        }))
    }

    const updateTask = (taskId: string, updates: Partial<ProjectTaskDefinition>) => {
        setTemplateData(prev => ({
            ...prev,
            tasks: prev.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
        }))
    }

    const addDoDItem = (taskId: string) => {
        setTemplateData(prev => ({
            ...prev,
            tasks: prev.tasks.map(t => {
                if (t.id === taskId) {
                    const newDoD = {
                        id: `dod-${Date.now()}`,
                        text: '',
                        isRequired: true,
                        order: (t.definitionOfDone?.length || 0) + 1
                    }
                    return {
                        ...t,
                        definitionOfDone: [...(t.definitionOfDone || []), newDoD]
                    }
                }
                return t
            })
        }))
    }

    const updateDoDItem = (taskId: string, dodId: string, text: string) => {
        setTemplateData(prev => ({
            ...prev,
            tasks: prev.tasks.map(t => {
                if (t.id === taskId) {
                    return {
                        ...t,
                        definitionOfDone: t.definitionOfDone?.map(d => d.id === dodId ? { ...d, text } : d)
                    }
                }
                return t
            })
        }))
    }

    const removeDoDItem = (taskId: string, dodId: string) => {
        setTemplateData(prev => ({
            ...prev,
            tasks: prev.tasks.map(t => {
                if (t.id === taskId) {
                    return {
                        ...t,
                        definitionOfDone: t.definitionOfDone?.filter(d => d.id !== dodId)
                    }
                }
                return t
            })
        }))
    }

    const handleSubmit = async () => {
        // Validation for step 3
        const invalidTask = templateData.tasks.find(t => !t.title.trim())
        if (invalidTask) {
            toast.error('All tasks must have a title')
            return
        }

        setIsSubmitting(true)
        try {
            const templateId = await ProjectTaskTemplateService.createTemplate(
                companyId,
                templateData as any,
                groupId
            )
            toast.success('Custom template created successfully')
            onTemplateCreated(templateId)
        } catch (error) {
            console.error('Error creating template:', error)
            toast.error('Failed to create template')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="flex items-center justify-between">
                        <span>Create Custom Template</span>
                        <Badge variant="outline">Step {step} of 3</Badge>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden p-6 pt-4">
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Template Name *</Label>
                                <Input
                                    id="name"
                                    value={templateData.name}
                                    onChange={(e) => setTemplateData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g., Q1 Audit Preparation"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="description">Description (Optional)</Label>
                                <Textarea
                                    id="description"
                                    value={templateData.description}
                                    onChange={(e) => setTemplateData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="What is this template for?"
                                    rows={3}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Category</Label>
                                    <Select
                                        value={templateData.category}
                                        onValueChange={(v) => setTemplateData(prev => ({ ...prev, category: v as any }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="manufacturing">Manufacturing</SelectItem>
                                            <SelectItem value="software">Software</SelectItem>
                                            <SelectItem value="marketing">Marketing</SelectItem>
                                            <SelectItem value="operations">Operations</SelectItem>
                                            <SelectItem value="custom">Custom</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Project Type</Label>
                                    <Select
                                        value={templateData.projectType}
                                        onValueChange={(v) => setTemplateData(prev => ({ ...prev, projectType: v as any }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="rft">RFT</SelectItem>
                                            <SelectItem value="reports">Reports</SelectItem>
                                            <SelectItem value="compliance">Compliance</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="h-full flex flex-col space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Define Tasks</Label>
                                <Button size="sm" onClick={addTask} className="gap-2">
                                    <Plus className="h-4 w-4" /> Add Task
                                </Button>
                            </div>
                            <ScrollArea className="flex-1 border rounded-md p-4">
                                <div className="space-y-4">
                                    {templateData.tasks.map((task, index) => (
                                        <div key={task.id} className="relative group p-4 border border-dashed rounded-lg bg-muted/30">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeTask(task.id)}
                                                className="absolute top-2 right-2 text-muted-foreground hover:text-destructive h-8 w-8"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            <div className="space-y-3">
                                                <div className="grid gap-1">
                                                    <Label className="text-xs">Task {index + 1} Title *</Label>
                                                    <Input
                                                        value={task.title}
                                                        onChange={(e) => updateTask(task.id, { title: e.target.value })}
                                                        placeholder="Enter task title"
                                                    />
                                                </div>
                                                <div className="grid gap-1">
                                                    <Label className="text-xs">Task Description</Label>
                                                    <Input
                                                        value={task.description}
                                                        onChange={(e) => updateTask(task.id, { description: e.target.value })}
                                                        placeholder="Briefly describe the task"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {templateData.tasks.length === 0 && (
                                        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                                            No tasks added. Click "Add Task" to begin.
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="h-full flex flex-col space-y-4">
                            <Label>Configure Task Details & DoD</Label>
                            <ScrollArea className="flex-1 border rounded-md p-4">
                                <div className="space-y-8">
                                    {templateData.tasks.map((task, index) => (
                                        <Card key={task.id} className="border-l-4 border-l-primary shadow-sm">
                                            <CardContent className="pt-6 space-y-6">
                                                <div className="flex items-center gap-3">
                                                    <Badge className="h-6 w-6 rounded-full p-0 flex items-center justify-center bg-primary/10 text-primary border-primary/20">
                                                        {index + 1}
                                                    </Badge>
                                                    <h3 className="font-semibold text-lg">{task.title || 'Untitled Task'}</h3>
                                                </div>

                                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                                    <div className="grid gap-2">
                                                        <Label className="text-xs">Priority</Label>
                                                        <Select
                                                            value={task.priority}
                                                            onValueChange={(v) => updateTask(task.id, { priority: v as any })}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="low">Low</SelectItem>
                                                                <SelectItem value="medium">Medium</SelectItem>
                                                                <SelectItem value="high">High</SelectItem>
                                                                <SelectItem value="urgent">Urgent</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="grid gap-2">
                                                        <Label className="text-xs">Estimated Hours</Label>
                                                        <Input
                                                            type="number"
                                                            value={task.estimatedHours.toString()}
                                                            onChange={(e) => updateTask(task.id, { estimatedHours: parseInt(e.target.value) || 0 })}
                                                        />
                                                    </div>
                                                    <div className="grid gap-2">
                                                        <Label className="text-xs">Due Date Offset (Days)</Label>
                                                        <Input
                                                            type="number"
                                                            value={task.dueDateOffsetDays.toString()}
                                                            onChange={(e) => updateTask(task.id, { dueDateOffsetDays: parseInt(e.target.value) || 0 })}
                                                        />
                                                    </div>
                                                </div>

                                                <Separator />

                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Definition of Done (Checklist)</Label>
                                                        <Button variant="ghost" size="sm" onClick={() => addDoDItem(task.id)} className="h-6 gap-1 text-xs">
                                                            <Plus className="h-3 w-3" /> Add Item
                                                        </Button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {task.definitionOfDone?.map((dod) => (
                                                            <div key={dod.id} className="flex gap-2 items-center">
                                                                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                                                                <Input
                                                                    className="h-8"
                                                                    value={dod.text}
                                                                    onChange={(e) => updateDoDItem(task.id, dod.id, e.target.value)}
                                                                    placeholder="Requirement text..."
                                                                />
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => removeDoDItem(task.id, dod.id)}
                                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                        {(task.definitionOfDone?.length || 0) === 0 && (
                                                            <p className="text-xs text-muted-foreground italic">No DoD items added for this task.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 border-t bg-card/50">
                    <div className="flex w-full justify-between items-center">
                        <Button variant="outline" onClick={step === 1 ? onClose : handleBack} disabled={isSubmitting}>
                            {step === 1 ? 'Cancel' : (
                                <><ChevronLeft className="mr-2 h-4 w-4" /> Back</>
                            )}
                        </Button>
                        <div className="flex gap-2">
                            {step < 3 ? (
                                <Button onClick={handleNext}>
                                    Next Phase <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            ) : (
                                <Button onClick={handleSubmit} disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Saving Template...
                                        </>
                                    ) : (
                                        'Create Entire Template'
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
