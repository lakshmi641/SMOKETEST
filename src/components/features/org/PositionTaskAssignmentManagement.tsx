'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useCompany } from '@/hooks/useCompany'
import { TaskTemplateService, PositionTaskAssignmentService } from '@/lib/services'
import { getPositions, getOrgUnits } from '@/lib/services/org'
import { Plus, Search, Settings, Users, FileText, Calendar, AlertCircle } from 'lucide-react'
import type { TaskTemplate, PositionTaskTemplate } from '@/types/task-template-schema'
import type { Position } from '@/types/org-schema'
import type { OrgUnit } from '@/types/org-schema'

export function PositionTaskAssignmentManagement() {
  const { currentCompany, groupId } = useCompany()
  const [positions, setPositions] = useState<Position[]>([])
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [positionAssignments, setPositionAssignments] = useState<PositionTaskTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [formData, setFormData] = useState({
    templateId: '',
    assignmentMode: 'on_assignment' as 'immediate' | 'on_assignment' | 'scheduled' | 'conditional',
    assignmentDate: '',
    customDueDateOffset: '',
    customPriority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    customInstructions: '',
    generateForCurrentUsers: false,
  })

  const assignmentModes = [
    { value: 'immediate', label: 'Immediate', description: 'Generate tasks immediately when assigned' },
    { value: 'on_assignment', label: 'On Assignment', description: 'Generate tasks when user is assigned to position' },
    { value: 'scheduled', label: 'Scheduled', description: 'Generate tasks on a specific date' },
    { value: 'conditional', label: 'Conditional', description: 'Generate tasks based on conditions' },
  ]

  const priorities = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ]

  useEffect(() => {
    if (currentCompany?.id) {
      loadData()
    }
  }, [currentCompany])

  async function loadData() {
    if (!currentCompany?.id) return

    try {
      setLoading(true)

      // Load positions and org units
      const [positionsData, orgUnitsData] = await Promise.all([
        getPositions(currentCompany.id, groupId ?? undefined),
        getOrgUnits(currentCompany.id, groupId ?? undefined)
      ])
      setPositions(positionsData)
      setOrgUnits(orgUnitsData)

      // Load templates
      const templatesData = await TaskTemplateService.getTaskTemplates(
        currentCompany.id,
        { isActive: true },
        groupId!
      )

      // Debug: Check for duplicate or empty template IDs
      console.log('Loaded templates for assignment:', templatesData)
      const templateIds = templatesData.map(t => t.id)
      const uniqueTemplateIds = new Set(templateIds)
      if (templateIds.length !== uniqueTemplateIds.size) {
        console.warn('Duplicate template IDs found in assignment:', templateIds)
      }
      if (templateIds.some(id => !id)) {
        console.warn('Empty template IDs found in assignment:', templateIds)
      }

      setTemplates(templatesData)

      // Load position assignments
      const assignmentsData = await Promise.all(
        positionsData.map(async (position) => {
          const assignments = await TaskTemplateService.getPositionTaskTemplates(
            currentCompany.id,
            position.id,
            groupId!
          )
          return assignments.map(assignment => ({
            ...assignment,
            positionTitle: position.title,
            positionDepartment: position.orgUnitId,
          }))
        })
      )

      // Debug: Check for duplicate or empty assignment IDs
      const flatAssignments = assignmentsData.flat()
      console.log('Loaded position assignments:', flatAssignments)
      const assignmentIds = flatAssignments.map(a => a.id)
      const uniqueAssignmentIds = new Set(assignmentIds)
      if (assignmentIds.length !== uniqueAssignmentIds.size) {
        console.warn('Duplicate assignment IDs found:', assignmentIds)
      }
      if (assignmentIds.some(id => !id)) {
        console.warn('Empty assignment IDs found:', assignmentIds)
      }

      setPositionAssignments(flatAssignments)

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleAssignTemplate(position: Position) {
    setSelectedPosition(position)
    setFormData({
      templateId: '',
      assignmentMode: 'on_assignment',
      assignmentDate: '',
      customDueDateOffset: '',
      customPriority: 'medium',
      customInstructions: '',
      generateForCurrentUsers: false,
    })
    setIsDialogOpen(true)
  }

  async function handleSaveAssignment() {
    if (!currentCompany?.id || !selectedPosition || !formData.templateId) return

    try {
      const assignmentConfig: any = {
        assignmentMode: formData.assignmentMode,
        customPriority: formData.customPriority,
        generateForCurrentUsers: formData.generateForCurrentUsers,
      }

      // Only include assignmentDate if it has a value
      if (formData.assignmentDate) {
        assignmentConfig.assignmentDate = formData.assignmentDate
      }

      // Only include customDueDateOffset if it has a value (including 0)
      if (formData.customDueDateOffset !== '') {
        assignmentConfig.customDueDateOffset = parseInt(formData.customDueDateOffset)
      }

      // Only include customInstructions if it has a value
      if (formData.customInstructions) {
        assignmentConfig.customInstructions = formData.customInstructions
      }

      const { assignmentId, tasks } = await PositionTaskAssignmentService.assignTemplateToPosition(
        currentCompany.id,
        selectedPosition.id,
        formData.templateId,
        assignmentConfig,
        groupId!
      )

      console.log(`Assigned template to position. Generated ${tasks.length} tasks.`)
      await loadData()
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Error assigning template to position:', error)
    }
  }

  async function handleRemoveAssignment(assignmentId: string, positionId: string, templateId: string) {
    if (!confirm('Are you sure you want to remove this template assignment?')) return
    if (!currentCompany?.id) return

    try {
      await PositionTaskAssignmentService.removeTemplateFromPosition(
        currentCompany.id,
        positionId,
        templateId,
        groupId!
      )
      await loadData()
    } catch (error) {
      console.error('Error removing template assignment:', error)
    }
  }

  function getPositionName(positionId: string): string {
    const position = positions.find(p => p.id === positionId)
    return position?.title || 'Unknown Position'
  }

  function getTemplateName(templateId: string): string {
    const template = templates.find(t => t.id === templateId)
    return template?.name || 'Unknown Template'
  }

  function getOrgUnitName(orgUnitId: string): string {
    const orgUnit = orgUnits.find(d => d.id === orgUnitId)
    return orgUnit?.name || orgUnitId
  }

  function getPositionById(positionId: string) {
    return positions.find(p => p.id === positionId)
  }

  const filteredPositions = positions.filter(position =>
    position.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (position.orgUnitId ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading position assignments...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600">Assign task templates to positions for automatic task generation</p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search positions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Positions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPositions.map((position, index) => {
          const currentPositionAssignments = positionAssignments.filter(pa => pa.positionId === position.id)

          return (
            <Card key={position.id || `position-${index}`} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{position.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {getOrgUnitName(position.orgUnitId ?? '')}
                    </CardDescription>
                  </div>
                  <Badge variant={position.status === 'active' ? 'default' : 'destructive'}>
                    {position.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="h-4 w-4" />
                    <span>Level {position.level}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FileText className="h-4 w-4" />
                    <span>{currentPositionAssignments.length} templates assigned</span>
                  </div>

                  {currentPositionAssignments.length > 0 && (
                    <div className="space-y-2">
                      <Separator />
                      <div className="text-sm font-medium text-gray-700">Assigned Templates:</div>
                      <div className="space-y-1">
                        {currentPositionAssignments.slice(0, 3).map(assignment => (
                          <div key={assignment.id} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{getTemplateName(assignment.templateId)}</span>
                            <Badge variant="outline" className="text-xs">
                              {assignment.assignmentMode}
                            </Badge>
                          </div>
                        ))}
                        {currentPositionAssignments.length > 3 && (
                          <div className="text-xs text-gray-500">
                            +{currentPositionAssignments.length - 3} more templates
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <Separator />

                  <Button
                    onClick={() => handleAssignTemplate(position)}
                    className="w-full"
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Assign Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Assignments Table */}
      {positionAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Template Assignments</CardTitle>
            <CardDescription>
              Overview of all task template assignments to positions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {positionAssignments.map((assignment, index) => (
                  <div key={assignment.id || `assignment-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium">{getPositionName(assignment.positionId)}</div>
                          <div className="text-sm text-gray-600">{getOrgUnitName(getPositionById(assignment.positionId)?.orgUnitId || '')}</div>
                        </div>
                        <Separator orientation="vertical" className="h-8" />
                        <div>
                          <div className="font-medium">{getTemplateName(assignment.templateId)}</div>
                          <div className="text-sm text-gray-600">
                            {assignment.assignmentCount} tasks generated
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{assignment.assignmentMode}</Badge>
                      {assignment.customPriority && (
                        <Badge variant="outline">{assignment.customPriority}</Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveAssignment(
                          assignment.id,
                          assignment.positionId,
                          assignment.templateId
                        )}
                        className="text-red-600 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Assign Template Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Assign Task Template to {selectedPosition?.title}
            </DialogTitle>
            <DialogDescription>
              Configure how tasks from this template should be generated for this position
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Template Selection */}
            <div>
              <Label htmlFor="templateId">Task Template *</Label>
              <Select value={formData.templateId} onValueChange={(value) => setFormData({ ...formData, templateId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.filter(template => template.id).map((template, index) => (
                    <SelectItem key={template.id || `template-${index}`} value={template.id}>
                      <span>{template.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assignment Mode */}
            <div>
              <Label htmlFor="assignmentMode">Assignment Mode *</Label>
              <Select
                value={formData.assignmentMode}
                onValueChange={(value) => setFormData({ ...formData, assignmentMode: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignmentModes.map(mode => (
                    <SelectItem key={mode.value} value={mode.value}>
                      <div>
                        <div className="font-medium">{mode.label}</div>
                        <div className="text-sm text-gray-600">{mode.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Scheduled Assignment Date */}
            {formData.assignmentMode === 'scheduled' && (
              <div>
                <Label htmlFor="assignmentDate">Assignment Date *</Label>
                <Input
                  id="assignmentDate"
                  type="date"
                  value={formData.assignmentDate}
                  onChange={(e) => setFormData({ ...formData, assignmentDate: e.target.value })}
                />
              </div>
            )}

            {/* Customizations */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Position-Specific Customizations</h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customDueDateOffset">Custom Due Date Offset (days)</Label>
                  <Input
                    id="customDueDateOffset"
                    type="number"
                    value={formData.customDueDateOffset}
                    onChange={(e) => setFormData({ ...formData, customDueDateOffset: e.target.value })}
                    placeholder="Leave empty to use template default"
                  />
                </div>
                <div>
                  <Label htmlFor="customPriority">Custom Priority</Label>
                  <Select
                    value={formData.customPriority}
                    onValueChange={(value) => setFormData({ ...formData, customPriority: value as any })}
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
              </div>

              <div>
                <Label htmlFor="customInstructions">Custom Instructions</Label>
                <Input
                  id="customInstructions"
                  value={formData.customInstructions}
                  onChange={(e) => setFormData({ ...formData, customInstructions: e.target.value })}
                  placeholder="Additional instructions for this position"
                />
              </div>
            </div>

            {/* Generate for Current Users */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="generateForCurrentUsers"
                checked={formData.generateForCurrentUsers}
                onChange={(e) => setFormData({ ...formData, generateForCurrentUsers: e.target.checked })}
              />
              <Label htmlFor="generateForCurrentUsers">
                Generate tasks for current users in this position
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAssignment} disabled={!formData.templateId}>
              Assign Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
