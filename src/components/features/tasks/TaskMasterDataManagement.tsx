'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { TaskMasterDataService, type TaskType, type RequirementType, type TaskStatus } from '@/lib/services/tasks/task-master-data-service'
import { Plus, Edit, Trash2, Settings, Tag, FileCheck, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export function TaskMasterDataManagement() {
  const { companyId, groupId } = useCompany()
  const { user: currentUser } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'taskTypes' | 'requirementTypes' | 'taskStatuses'>('taskTypes')
  
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([])
  const [requirementTypes, setRequirementTypes] = useState<RequirementType[]>([])
  const [taskStatuses, setTaskStatuses] = useState<TaskStatus[]>([])
  
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<TaskType | RequirementType | TaskStatus | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    color: '#3b82f6',
    isActive: true,
    order: 0,
  })

  useEffect(() => {
    if (companyId) {
      loadData()
    }
  }, [companyId, activeTab])

  async function loadData() {
    if (!companyId) return
    try {
      setLoading(true)
      if (activeTab === 'taskTypes') {
        const data = await TaskMasterDataService.getTaskTypes(companyId, groupId ?? undefined)
        setTaskTypes(data)
      } else if (activeTab === 'requirementTypes') {
        const data = await TaskMasterDataService.getRequirementTypes(companyId, groupId ?? undefined)
        setRequirementTypes(data)
      } else if (activeTab === 'taskStatuses') {
        const data = await TaskMasterDataService.getTaskStatuses(companyId, groupId ?? undefined)
        setTaskStatuses(data)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  function handleOpenDialog(item?: TaskType | RequirementType | TaskStatus) {
    if (item) {
      setEditingItem(item)
      setFormData({
        name: item.name,
        code: 'code' in item ? item.code : '',
        description: item.description || '',
        color: item.color || '#3b82f6',
        isActive: item.isActive,
        order: item.order,
      })
    } else {
      setEditingItem(null)
      setFormData({
        name: '',
        code: '',
        description: '',
        color: '#3b82f6',
        isActive: true,
        order: activeTab === 'taskTypes' ? taskTypes.length : activeTab === 'requirementTypes' ? requirementTypes.length : taskStatuses.length,
      })
    }
    setDialogOpen(true)
  }

  function handleCloseDialog() {
    setDialogOpen(false)
    setEditingItem(null)
    setFormData({
      name: '',
      code: '',
      description: '',
      color: '#3b82f6',
      isActive: true,
      order: 0,
    })
  }

  async function handleSubmit() {
    if (!companyId || !currentUser?.id || !formData.name.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      if (activeTab === 'taskTypes') {
        if (editingItem) {
          await TaskMasterDataService.updateTaskType(
            companyId,
            editingItem.id,
            {
              name: formData.name,
              description: formData.description || undefined,
              color: formData.color,
              isActive: formData.isActive,
              order: formData.order,
            },
            currentUser.id
          )
          toast.success('Task type updated')
        } else {
          await TaskMasterDataService.createTaskType(
            companyId,
            {
              companyId,
              name: formData.name,
              description: formData.description || undefined,
              color: formData.color,
              isActive: formData.isActive,
              order: formData.order,
              createdBy: currentUser.id,
            },
            currentUser.id
          )
          toast.success('Task type created')
        }
      } else if (activeTab === 'requirementTypes') {
        if (editingItem) {
          await TaskMasterDataService.updateRequirementType(
            companyId,
            editingItem.id,
            {
              name: formData.name,
              description: formData.description || undefined,
              color: formData.color,
              isActive: formData.isActive,
              order: formData.order,
            },
            currentUser.id
          )
          toast.success('Requirement type updated')
        } else {
          await TaskMasterDataService.createRequirementType(
            companyId,
            {
              companyId,
              name: formData.name,
              description: formData.description || undefined,
              color: formData.color,
              isActive: formData.isActive,
              order: formData.order,
              createdBy: currentUser.id,
            },
            currentUser.id
          )
          toast.success('Requirement type created')
        }
      } else if (activeTab === 'taskStatuses') {
        if (!formData.code.trim()) {
          toast.error('Status code is required')
          return
        }
        if (editingItem) {
          await TaskMasterDataService.updateTaskStatus(
            companyId,
            editingItem.id,
            {
              name: formData.name,
              code: formData.code,
              description: formData.description || undefined,
              color: formData.color,
              isActive: formData.isActive,
              order: formData.order,
            },
            currentUser.id
          )
          toast.success('Task status updated')
        } else {
          await TaskMasterDataService.createTaskStatus(
            companyId,
            {
              companyId,
              name: formData.name,
              code: formData.code,
              description: formData.description || undefined,
              color: formData.color,
              isActive: formData.isActive,
              isSystem: false,
              order: formData.order,
              createdBy: currentUser.id,
            },
            currentUser.id
          )
          toast.success('Task status created')
        }
      }

      handleCloseDialog()
      await loadData()
    } catch (error: any) {
      console.error('Error saving:', error)
      toast.error(error.message || 'Failed to save')
    }
  }

  async function handleDelete(item: TaskType | RequirementType | TaskStatus) {
    if (!companyId) return
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return

    try {
      if (activeTab === 'taskTypes') {
        await TaskMasterDataService.deleteTaskType(companyId, item.id)
        toast.success('Task type deleted')
      } else if (activeTab === 'requirementTypes') {
        await TaskMasterDataService.deleteRequirementType(companyId, item.id)
        toast.success('Requirement type deleted')
      } else if (activeTab === 'taskStatuses') {
        await TaskMasterDataService.deleteTaskStatus(companyId, item.id)
        toast.success('Task status deleted')
      }
      await loadData()
    } catch (error: any) {
      console.error('Error deleting:', error)
      toast.error(error.message || 'Failed to delete')
    }
  }

  const currentItems = activeTab === 'taskTypes' ? taskTypes : activeTab === 'requirementTypes' ? requirementTypes : taskStatuses
  const title = activeTab === 'taskTypes' ? 'Task Types' : activeTab === 'requirementTypes' ? 'Requirement Types' : 'Task Statuses'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 mt-1">Manage task types, requirement types, and task statuses</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add {title.slice(0, -1)}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingItem ? `Edit ${title.slice(0, -1)}` : `Create ${title.slice(0, -1)}`}</DialogTitle>
              <DialogDescription>
                {editingItem ? 'Update the details below' : 'Fill in the details to create a new item'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter name"
                />
              </div>
              {activeTab === 'taskStatuses' && (
                <div>
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    placeholder="e.g., in_progress"
                  />
                  <p className="text-xs text-gray-500 mt-1">Used in code (lowercase, underscores)</p>
                </div>
              )}
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="h-10"
                  />
                </div>
                <div>
                  <Label htmlFor="order">Order</Label>
                  <Input
                    id="order"
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit}>
                  {editingItem ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('taskTypes')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'taskTypes'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Tag className="h-4 w-4 inline mr-2" />
            Task Types
          </button>
          <button
            onClick={() => setActiveTab('requirementTypes')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'requirementTypes'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileCheck className="h-4 w-4 inline mr-2" />
            Requirement Types
          </button>
          <button
            onClick={() => setActiveTab('taskStatuses')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'taskStatuses'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <CheckCircle className="h-4 w-4 inline mr-2" />
            Task Statuses
          </button>
        </nav>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                {activeTab === 'taskStatuses' && <TableHead>Code</TableHead>}
                <TableHead>Description</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                {activeTab === 'taskStatuses' && <TableHead>System</TableHead>}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeTab === 'taskStatuses' ? 8 : 7} className="text-center py-12 text-gray-500">
                    No items found. Click "Add {title.slice(0, -1)}" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                currentItems.map((item) => {
                  const isStatusTab = activeTab === 'taskStatuses'
                  const statusItem = isStatusTab ? (item as TaskStatus) : null

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      {isStatusTab && (
                        <TableCell>
                          <Badge variant="outline">{statusItem?.code}</Badge>
                        </TableCell>
                      )}
                      <TableCell className="text-gray-600">{item.description || '-'}</TableCell>
                      <TableCell>
                        <div
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: item.color || '#3b82f6' }}
                        />
                      </TableCell>
                      <TableCell>{item.order}</TableCell>
                      <TableCell>
                        <Badge variant={item.isActive ? 'default' : 'secondary'}>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      {isStatusTab && (
                        <TableCell>
                          {statusItem?.isSystem ? (
                            <Badge variant="outline">System</Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!(isStatusTab && statusItem?.isSystem) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(item)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

