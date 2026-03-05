'use client'

import { useState, useEffect } from 'react'
import { Plus, Shield, Edit, Trash2, Search, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PolicyService } from '@/lib/services/access-control/policy-service'
import { RoleService } from '@/lib/services/access-control/role-service'
import type { AccessPolicy, PolicyCondition, PolicyGrant } from '@/types/access-control-schema'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

export function PolicyManagement() {
  const { currentCompany, groupId } = useCompany()
  const { user } = useAuthStore()
  const companyId = currentCompany?.id
  const effectiveGroupId = groupId ?? companyId ?? ''
  const userId = user?.id || ''
  
  const [policies, setPolicies] = useState<AccessPolicy[]>([])
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<AccessPolicy | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Form state
  const [formData, setFormData] = useState<{
    name: string
    description: string
    isActive: boolean
    priority: number
    condition: {
      attribute: string
      operator: 'lte' | 'gte' | 'eq' | 'ne' | 'contains' | 'in' | 'not_in'
      value: string
    }
    grant: {
      roleId: string
      permissions: string[]
      resourceScope: 'all_workspaces' | 'own_department' | 'own_workspace' | 'assigned_projects' | 'all'
    }
  }>({
    name: '',
    description: '',
    isActive: true,
    priority: 100,
    condition: {
      attribute: 'user.position.level',
      operator: 'lte',
      value: '',
    },
    grant: {
      roleId: '',
      permissions: [],
      resourceScope: 'all_workspaces',
    },
  })

  useEffect(() => {
    if (companyId) {
      loadData()
    }
  }, [companyId])

  async function loadData() {
    if (!companyId) return

    try {
      setLoading(true)
      const [policiesData, rolesData] = await Promise.all([
        PolicyService.getPolicies(companyId, undefined, groupId ?? undefined),
        RoleService.getRoles(effectiveGroupId, companyId),
      ])
      setPolicies(policiesData)
      setRoles(rolesData.map(r => ({ id: r.id, name: r.name })))
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load policies')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      description: '',
      isActive: true,
      priority: 100,
      condition: {
        attribute: 'user.position.level',
        operator: 'lte',
        value: '',
      },
      grant: {
        roleId: '',
        permissions: [],
        resourceScope: 'all_workspaces',
      },
    })
    setEditingPolicy(null)
  }

  function openCreateDialog() {
    resetForm()
    setIsDialogOpen(true)
  }

  function openEditDialog(policy: AccessPolicy) {
    setFormData({
      name: policy.name,
      description: policy.description || '',
      isActive: policy.isActive,
      priority: policy.priority,
      condition: {
        attribute: policy.condition.attribute,
        operator: policy.condition.operator,
        value: Array.isArray(policy.condition.value) 
          ? policy.condition.value.join(',') 
          : String(policy.condition.value),
      },
      grant: {
        roleId: policy.grant.roleId || '',
        permissions: policy.grant.permissions || [],
        resourceScope: policy.grant.resourceScope,
      },
    })
    setEditingPolicy(policy)
    setIsDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!companyId || !userId) return

    try {
      setSubmitting(true)

      // Validate condition value based on operator
      let conditionValue: any = formData.condition.value
      if (formData.condition.operator === 'in' || formData.condition.operator === 'not_in') {
        // For 'in' and 'not_in', value should be an array
        conditionValue = formData.condition.value.split(',').map(v => v.trim())
      } else if (formData.condition.operator === 'lte' || formData.condition.operator === 'gte') {
        // For numeric comparisons, convert to number
        conditionValue = Number(formData.condition.value)
      }

      const policyData: Omit<AccessPolicy, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> = {
        companyId,
        name: formData.name,
        description: formData.description,
        isActive: formData.isActive,
        priority: formData.priority,
        condition: {
          ...formData.condition,
          value: conditionValue,
        },
        grant: {
          roleId: formData.grant.roleId && formData.grant.roleId !== '__none__' ? formData.grant.roleId : undefined,
          permissions: formData.grant.permissions.length > 0 ? formData.grant.permissions : undefined,
          resourceScope: formData.grant.resourceScope,
        },
      }

      if (editingPolicy) {
        await PolicyService.updatePolicy(companyId, editingPolicy.id, policyData, userId, groupId ?? undefined)
        toast.success('Policy updated successfully')
      } else {
        await PolicyService.createPolicy(companyId, policyData, userId, groupId ?? undefined)
        toast.success('Policy created successfully')
      }

      setIsDialogOpen(false)
      resetForm()
      await loadData()
    } catch (error: any) {
      console.error('Error saving policy:', error)
      toast.error(error.message || 'Failed to save policy')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(policyId: string) {
    if (!companyId) return
    if (!confirm('Are you sure you want to delete this policy? This action cannot be undone.')) {
      return
    }

    try {
      await PolicyService.deletePolicy(companyId, policyId, groupId ?? undefined)
      toast.success('Policy deleted successfully')
      await loadData()
    } catch (error: any) {
      console.error('Error deleting policy:', error)
      toast.error(error.message || 'Failed to delete policy')
    }
  }

  const filteredPolicies = policies.filter(policy =>
    policy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (policy.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!companyId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-gray-500">Please select a company to manage policies.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Access Policies</h2>
          <p className="text-gray-600 mt-1">Create attribute-based access control (ABAC) policies</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Policy
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPolicy ? 'Edit Policy' : 'Create New Policy'}</DialogTitle>
              <DialogDescription>
                {editingPolicy ? 'Update policy conditions and grants' : 'Define a new access policy based on user attributes'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Policy Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Level 2+ View All Workspaces"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this policy does"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: Number(e.target.value) }))}
                    min={0}
                    max={1000}
                  />
                  <p className="text-xs text-gray-500">Higher priority policies are evaluated first</p>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.isActive ? 'active' : 'inactive'}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isActive: value === 'active' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Condition */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Condition</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="attribute">Attribute</Label>
                    <Select
                      value={formData.condition.attribute}
                      onValueChange={(value) =>
                        setFormData(prev => ({
                          ...prev,
                          condition: { ...prev.condition, attribute: value },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user.position.level">Position Level</SelectItem>
                        <SelectItem value="user.department">Department</SelectItem>
                        <SelectItem value="user.role">User Role</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="operator">Operator</Label>
                    <Select
                      value={formData.condition.operator}
                      onValueChange={(value: any) =>
                        setFormData(prev => ({
                          ...prev,
                          condition: { ...prev.condition, operator: value },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eq">Equals (=)</SelectItem>
                        <SelectItem value="ne">Not Equals (≠)</SelectItem>
                        <SelectItem value="lte">Less Than or Equal (≤)</SelectItem>
                        <SelectItem value="gte">Greater Than or Equal (≥)</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="in">In</SelectItem>
                        <SelectItem value="not_in">Not In</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="value">Value</Label>
                    <Input
                      id="value"
                      value={formData.condition.value}
                      onChange={(e) =>
                        setFormData(prev => ({
                          ...prev,
                          condition: { ...prev.condition, value: e.target.value },
                        }))
                      }
                      placeholder={formData.condition.operator === 'in' ? 'comma-separated values' : 'value'}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Grant */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Grant</h3>
                <div className="space-y-2">
                  <Label htmlFor="resourceScope">Resource Scope</Label>
                  <Select
                    value={formData.grant.resourceScope}
                    onValueChange={(value: any) =>
                      setFormData(prev => ({
                        ...prev,
                        grant: { ...prev.grant, resourceScope: value },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_workspaces">All Workspaces</SelectItem>
                      <SelectItem value="own_department">Own Department</SelectItem>
                      <SelectItem value="own_workspace">Own Workspace</SelectItem>
                      <SelectItem value="assigned_projects">Assigned Projects</SelectItem>
                      <SelectItem value="all">All Resources</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="roleId">Grant Role (Optional)</Label>
                  <Select
                    value={formData.grant.roleId || '__none__'}
                    onValueChange={(value) =>
                      setFormData(prev => ({
                        ...prev,
                        grant: { ...prev.grant, roleId: value === '__none__' ? '' : value },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {roles.map(role => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">Policy Example:</p>
                      <p className="text-xs">
                        If <strong>{formData.condition.attribute}</strong> {formData.condition.operator}{' '}
                        <strong>{formData.condition.value}</strong>, then grant access to{' '}
                        <strong>{formData.grant.resourceScope.replace('_', ' ')}</strong>
                        {formData.grant.roleId && formData.grant.roleId !== '__none__' && ` with role: ${roles.find(r => r.id === formData.grant.roleId)?.name}`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false)
                    resetForm()
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editingPolicy ? 'Update Policy' : 'Create Policy'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search policies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Policies Table */}
      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">Loading policies...</p>
          </CardContent>
        </Card>
      ) : filteredPolicies.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">No policies found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Grant</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPolicies.map(policy => (
                  <TableRow key={policy.id}>
                    <TableCell className="font-medium">{policy.name}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-mono text-xs">
                          {policy.condition.attribute} {policy.condition.operator} {String(policy.condition.value)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <Badge variant="outline" className="mr-2">
                          {policy.grant.resourceScope.replace('_', ' ')}
                        </Badge>
                        {policy.grant.roleId && (
                          <span className="text-xs text-gray-500">
                            Role: {roles.find(r => r.id === policy.grant.roleId)?.name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{policy.priority}</TableCell>
                    <TableCell>
                      {policy.isActive ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(policy)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(policy.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

