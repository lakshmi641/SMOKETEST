'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useCompany } from '@/hooks/useCompany'
import { TaskTemplateService } from '@/lib/services'
import { getPositions, getOrgUnits } from '@/lib/services/org'
import { getActiveApprovalLines } from '@/lib/services/approval-line-service'
import { Plus, Search, Filter, Edit, Trash2, Copy, Eye, Settings } from 'lucide-react'
import type { TaskTemplate, TaskDoDItem, TaskAssignmentCondition, TaskEscalationRule } from '@/types/task-template-schema'
import type { Position, OrgUnit } from '@/types/org-schema'
import type { ApprovalLine } from '@/types/approval-line-schema'

export function TaskTemplateManagement() {
  const { currentCompany, groupId } = useCompany()
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [workflows, setWorkflows] = useState<ApprovalLine[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null)
  const [formData, setFormData] = useState<Partial<TaskTemplate>>({
    name: '',
    description: '',
    department: [],
    positionLevel: [],
    priority: 'medium',
    estimatedHours: 1,
    dueDateOffset: 7,
    isRecurring: false,
    assignmentType: 'manual',
    requiredSkills: [],
    requiredCertifications: [],
    definitionOfDone: [],
    approvalRequired: false,
    complianceRequirements: [],
    qualityCheckpoints: [],
    safetyRequirements: [],
    tags: [],
    isActive: true,
    isSystemTemplate: false,
  })

  const priorities = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ]

  const assignmentTypes = [
    { value: 'automatic', label: 'Automatic' },
    { value: 'manual', label: 'Manual' },
    { value: 'conditional', label: 'Conditional' },
  ]

  useEffect(() => {
    if (currentCompany?.id) {
      loadTemplates()
    }
  }, [currentCompany])

  async function loadTemplates() {
    if (!currentCompany?.id) return

    try {
      setLoading(true)
      const [templatesData, positionsData, orgUnitsData, workflowsData] = await Promise.all([
        TaskTemplateService.getTaskTemplates(currentCompany.id),
        getPositions(currentCompany.id, groupId ?? undefined),
        getOrgUnits(currentCompany.id, groupId ?? undefined),
        getActiveApprovalLines(currentCompany.id)
      ])

      // Debug: Check for duplicate or empty IDs
      console.log('Loaded templates:', templatesData)
      const ids = templatesData.map(t => t.id)
      const uniqueIds = new Set(ids)
      if (ids.length !== uniqueIds.size) {
        console.warn('Duplicate template IDs found:', ids)
      }
      if (ids.some(id => !id)) {
        console.warn('Empty template IDs found:', ids)
      }

      setTemplates(templatesData)
      setPositions(positionsData)
      setOrgUnits(orgUnitsData)
      setWorkflows(workflowsData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleCreateTemplate() {
    setEditingTemplate(null)
    setFormData({
      name: '',
      description: '',
      department: [],
      positionLevel: [],
      priority: 'medium',
      estimatedHours: 1,
      dueDateOffset: 7,
      isRecurring: false,
      assignmentType: 'manual',
      requiredSkills: [],
      requiredCertifications: [],
      definitionOfDone: [],
      approvalRequired: false,
      complianceRequirements: [],
      qualityCheckpoints: [],
      safetyRequirements: [],
      tags: [],
      isActive: true,
      isSystemTemplate: false,
    })
    setIsDialogOpen(true)
  }

  function handleEditTemplate(template: TaskTemplate) {
    setEditingTemplate(template)
    setFormData(template)
    setIsDialogOpen(true)
  }

  async function handleSaveTemplate() {
    if (!currentCompany?.id || !formData.name) return

    try {
      if (editingTemplate) {
        await TaskTemplateService.updateTaskTemplate(
          currentCompany.id,
          editingTemplate.id,
          formData
        )
      } else {
        await TaskTemplateService.createTaskTemplate(currentCompany.id, {
          ...formData,
          createdBy: 'current-user-id', // TODO: Get from auth context
        } as any)
      }

      await loadTemplates()
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Error saving template:', error)
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    if (!confirm('Are you sure you want to delete this template?')) return
    if (!currentCompany?.id) return

    try {
      await TaskTemplateService.deleteTaskTemplate(currentCompany.id, templateId)
      await loadTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
    }
  }

  function addToArray(field: keyof TaskTemplate, value: string) {
    if (!value.trim()) return
    const currentArray = (formData[field] as string[]) || []
    setFormData({
      ...formData,
      [field]: [...currentArray, value.trim()],
    })
  }

  function removeFromArray(field: keyof TaskTemplate, index: number) {
    const currentArray = (formData[field] as string[]) || []
    setFormData({
      ...formData,
      [field]: currentArray.filter((_, i) => i !== index),
    })
  }

  function addDoDItem() {
    const newDoD: TaskDoDItem = {
      id: `dod-${Date.now()}`,
      text: '',
      isRequired: true,
      evidenceType: 'checklist',
      validationRules: [],
      order: (formData.definitionOfDone?.length || 0) + 1,
    }
    setFormData({
      ...formData,
      definitionOfDone: [...(formData.definitionOfDone || []), newDoD],
    })
  }

  function updateDoDItem(index: number, updates: Partial<TaskDoDItem>) {
    const updatedDoD = formData.definitionOfDone?.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    ) || []
    setFormData({
      ...formData,
      definitionOfDone: updatedDoD,
    })
  }

  function removeDoDItem(index: number) {
    const updatedDoD = formData.definitionOfDone?.filter((_, i) => i !== index) || []
    setFormData({
      ...formData,
      definitionOfDone: updatedDoD,
    })
  }

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch && template.id // Ensure template has valid ID
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading task templates...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600">Create and manage reusable task templates for your organization</p>
        </div>
        <Button onClick={handleCreateTemplate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template, index) => (
          <Card key={template.id || `template-${index}`} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {template.description}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={template.isSystemTemplate ? 'default' : 'secondary'}>
                    {template.isSystemTemplate ? 'System' : 'Custom'}
                  </Badge>
                  <Badge variant={template.isActive ? 'default' : 'destructive'}>
                    {template.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{template.priority}</Badge>
                </div>

                <div className="text-sm text-gray-600">
                  <p>Estimated Hours: {template.estimatedHours}</p>
                  <p>Due Date Offset: {template.dueDateOffset} days</p>
                  <p>Usage Count: {template.usageCount}</p>
                </div>

                {template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {template.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {template.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{template.tags.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditTemplate(template)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {/* TODO: Implement duplicate */ }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {/* TODO: Implement view */ }}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Settings className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm
              ? 'Try adjusting your search criteria'
              : 'Create your first task template to get started'
            }
          </p>
          {!searchTerm && (
            <Button onClick={handleCreateTemplate}>
              Create Your First Template
            </Button>
          )}
        </div>
      )}

      {/* Create/Edit Template Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Task Template' : 'Create Task Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? 'Update the task template details below'
                : 'Create a new reusable task template for your organization'
              }
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="assignment">Assignment</TabsTrigger>
              <TabsTrigger value="requirements">Requirements</TabsTrigger>
              <TabsTrigger value="workflow">Workflow</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Template Name *</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter template name"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this template is for"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority || 'medium'}
                    onValueChange={(value) => setFormData({ ...formData, priority: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorities.map(priority => (
                        <SelectItem key={priority.value} value={priority.value}>
                          {priority.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="estimatedHours">Estimated Hours</Label>
                  <Input
                    id="estimatedHours"
                    type="number"
                    value={formData.estimatedHours || 1}
                    onChange={(e) => setFormData({ ...formData, estimatedHours: parseInt(e.target.value) || 1 })}
                    min="1"
                  />
                </div>
                <div>
                  <Label htmlFor="dueDateOffset">Due Date Offset (days)</Label>
                  <Input
                    id="dueDateOffset"
                    type="number"
                    value={formData.dueDateOffset || 7}
                    onChange={(e) => setFormData({ ...formData, dueDateOffset: parseInt(e.target.value) || 7 })}
                    min="1"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="assignment" className="space-y-4">
              <div>
                <Label htmlFor="assignmentType">Assignment Type</Label>
                <Select
                  value={formData.assignmentType || 'manual'}
                  onValueChange={(value) => setFormData({ ...formData, assignmentType: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignmentTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reference: Existing Positions */}
              <div>
                <Label>Reference: Existing Positions</Label>
                <div className="text-sm text-gray-600 mb-2">
                  Select org units and levels that match your existing positions
                </div>
                <ScrollArea className="h-32 border rounded-md p-2">
                  <div className="space-y-1">
                    {positions.map(position => (
                      <div key={position.id} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium">{position.title}</span>
                          <span className="text-gray-500 ml-2">({position.orgUnitId})</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Level {position.level}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div>
                <Label>Org Units</Label>
                <div className="flex gap-2">
                  <Select onValueChange={(value) => addToArray('department', value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select org unit to add" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgUnits.map(orgUnit => (
                        <SelectItem key={orgUnit.id} value={orgUnit.name}>
                          {orgUnit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.department?.map((dept, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('department', index)}>
                      {dept} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Position Levels</Label>
                <div className="flex gap-2">
                  <Select onValueChange={(value) => addToArray('positionLevel', value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select position level to add" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(level => (
                        <SelectItem key={level} value={level.toString()}>
                          Level {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.positionLevel?.map((level, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('positionLevel', index)}>
                      Level {level} ×
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="requirements" className="space-y-4">
              <div>
                <Label>Required Skills</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add required skill"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addToArray('requiredSkills', e.currentTarget.value)
                        e.currentTarget.value = ''
                      }
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.requiredSkills?.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('requiredSkills', index)}>
                      {skill} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Required Certifications</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add required certification"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addToArray('requiredCertifications', e.currentTarget.value)
                        e.currentTarget.value = ''
                      }
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.requiredCertifications?.map((cert, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('requiredCertifications', index)}>
                      {cert} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Definition of Done</Label>
                <div className="space-y-2">
                  {formData.definitionOfDone?.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        value={item.text}
                        onChange={(e) => updateDoDItem(index, { text: e.target.value })}
                        placeholder="Enter requirement"
                      />
                      <Select
                        value={item.evidenceType}
                        onValueChange={(value) => updateDoDItem(index, { evidenceType: value as any })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="checklist">Checklist</SelectItem>
                          <SelectItem value="approval">Approval</SelectItem>
                          <SelectItem value="document">Document</SelectItem>
                          <SelectItem value="signature">Signature</SelectItem>
                          <SelectItem value="photo">Photo</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeDoDItem(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" onClick={addDoDItem} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Requirement
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="workflow" className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="approvalRequired"
                  checked={formData.approvalRequired || false}
                  onChange={(e) => setFormData({ ...formData, approvalRequired: e.target.checked })}
                />
                <Label htmlFor="approvalRequired">Requires Approval</Label>
              </div>

              {formData.approvalRequired && (
                <div className="pl-6 space-y-4 border-l-2 border-primary/20 ml-2">
                  <div>
                    <Label htmlFor="workflowId">Link to Workflow Definition</Label>
                    <Select
                      value={formData.approvalMatrix || ''}
                      onValueChange={(value) => setFormData({ ...formData, approvalMatrix: value })}
                    >
                      <SelectTrigger id="workflowId">
                        <SelectValue placeholder="Select a workflow..." />
                      </SelectTrigger>
                      <SelectContent>
                        {workflows.map((wf) => (
                          <SelectItem key={wf.id} value={wf.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{wf.name}</span>
                              <span className="text-[10px] text-muted-foreground">v{wf.version} • {wf.category}</span>
                            </div>
                          </SelectItem>
                        ))}
                        {workflows.length === 0 && (
                          <SelectItem value="none" disabled>No active workflows found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Choose which BPMN workflow should be triggered for tasks created from this template.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <Label>Compliance Requirements</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add compliance requirement"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addToArray('complianceRequirements', e.currentTarget.value)
                        e.currentTarget.value = ''
                      }
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.complianceRequirements?.map((req, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('complianceRequirements', index)}>
                      {req} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Quality Checkpoints</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add quality checkpoint"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addToArray('qualityCheckpoints', e.currentTarget.value)
                        e.currentTarget.value = ''
                      }
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.qualityCheckpoints?.map((checkpoint, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('qualityCheckpoints', index)}>
                      {checkpoint} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Safety Requirements</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add safety requirement"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addToArray('safetyRequirements', e.currentTarget.value)
                        e.currentTarget.value = ''
                      }
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.safetyRequirements?.map((req, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('safetyRequirements', index)}>
                      {req} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add tag"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addToArray('tags', e.currentTarget.value)
                        e.currentTarget.value = ''
                      }
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.tags?.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('tags', index)}>
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate}>
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
