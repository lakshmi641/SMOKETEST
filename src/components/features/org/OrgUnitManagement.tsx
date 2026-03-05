'use client'

import { useState } from 'react'
import { Plus, Building2, Edit2, Trash2, Archive, Search, List, Network } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { OrgUnit } from '@/types/org-schema'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { useOrgUnitsQuery, useOrgMutations } from '@/hooks/queries/useOrgQueries'
import { OrgUnitTreeView } from './OrgUnitTreeView'
import toast from 'react-hot-toast'

// Feature flag to control visibility of advanced fields
const SHOW_ADVANCED_FIELDS = false

export function OrgUnitManagement() {
  const { currentCompany } = useCompany()
  const { user } = useAuthStore()
  const companyId = currentCompany?.id
  const groupId = user?.enterpriseGroupId ?? null
  const { data: orgUnits = [], isLoading: loading } = useOrgUnitsQuery(companyId, groupId)
  const { createOrgUnit: createOrgUnitMutation, updateOrgUnit: updateOrgUnitMutation, deleteOrgUnit: deleteOrgUnitMutation } = useOrgMutations(companyId, groupId)
  const [submitting, setSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingOrgUnit, setEditingOrgUnit] = useState<OrgUnit | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; orgUnit: OrgUnit | null }>({
    open: false,
    orgUnit: null,
  })
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    parentOrgUnitId: null as string | null,
    location: '',
    costCenter: '',
    budget: 0,
    status: 'active' as 'active' | 'inactive' | 'archived',
  })

  function handleEdit(orgUnit: OrgUnit) {
    setEditingOrgUnit(orgUnit)
    setFormData({
      name: orgUnit.name,
      code: orgUnit.code,
      description: orgUnit.description,
      parentOrgUnitId: orgUnit.parentOrgUnitId,
      location: orgUnit.location || '',
      costCenter: orgUnit.costCenter || '',
      budget: orgUnit.budget || 0,
      status: orgUnit.status,
    })
    setIsDialogOpen(true)
  }

  function resetForm() {
    setEditingOrgUnit(null)
    setFormData({
      name: '',
      code: '',
      description: '',
      parentOrgUnitId: null,
      location: '',
      costCenter: '',
      budget: 0,
      status: 'active',
    })
    setIsDialogOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!companyId || !groupId || !user || submitting) return

    const userId = user.id
    try {
      setSubmitting(true)
      if (editingOrgUnit) {
        await updateOrgUnitMutation.mutateAsync({ orgUnitId: editingOrgUnit.id, updates: formData, userId })
      } else {
        await createOrgUnitMutation.mutateAsync({
          data: { ...formData, companyId, createdBy: userId, updatedBy: userId },
          userId,
        })
      }
      resetForm()
      toast.success(editingOrgUnit ? 'Org unit updated' : 'Org unit created')
    } catch (error) {
      console.error('Error saving org unit:', error)
    } finally {
      setSubmitting(false)
    }
  }

  function handleDeleteClick(orgUnit: OrgUnit) {
    setDeleteDialog({ open: true, orgUnit })
  }

  async function handleDeleteConfirm() {
    if (!deleteDialog.orgUnit || !companyId || !groupId || !user || submitting) return

    try {
      setSubmitting(true)
      await deleteOrgUnitMutation.mutateAsync({ orgUnitId: deleteDialog.orgUnit.id, userId: user.id })
      toast.success('Org unit archived successfully')
      setDeleteDialog({ open: false, orgUnit: null })
    } catch (error) {
      console.error('Error deleting org unit:', error)
    } finally {
      setSubmitting(false)
    }
  }

  function getParentOrgUnitName(parentId: string | null): string {
    if (!parentId) return '-'
    const parent = orgUnits.find(d => d.id === parentId)
    return parent?.name || 'Unknown'
  }

  // Filter org units based on search term
  const filteredOrgUnits = orgUnits.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dept.location && dept.location.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            Manage organizational units and their hierarchy
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search Box */}
          {!loading && orgUnits.length > 0 && (
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search org units..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
          )}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Org Unit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingOrgUnit ? 'Edit Org Unit' : 'Create Org Unit'}
                </DialogTitle>
                <DialogDescription>
                  {editingOrgUnit
                    ? 'Update org unit information'
                    : 'Add a new org unit to your organization'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Org Unit Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Manufacturing"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">Org Unit Code *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="e.g., MFG"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the org unit's responsibilities..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="parentOrgUnit">Parent Org Unit</Label>
                    <Select
                      value={formData.parentOrgUnitId || 'none'}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          parentOrgUnitId: value === 'none' ? null : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select parent org unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Show "None (Top Level)" only if no top-level org unit exists yet */}
                        {!orgUnits.some(ou => ou.parentOrgUnitId === null) && (
                          <SelectItem value="none">None (Top Level)</SelectItem>
                        )}
                        {/* Show all org units (including top-level) as parent options, except the one being edited */}
                        {orgUnits
                          .filter(d => d.id !== editingOrgUnit?.id)
                          .map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name} ({dept.code})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {SHOW_ADVANCED_FIELDS && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="e.g., Building A"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="costCenter">Cost Center</Label>
                      <Input
                        id="costCenter"
                        value={formData.costCenter}
                        onChange={(e) => setFormData({ ...formData, costCenter: e.target.value })}
                        placeholder="e.g., CC-1001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="budget">Annual Budget ($)</Label>
                      <Input
                        id="budget"
                        type="number"
                        value={formData.budget}
                        onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        {editingOrgUnit ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      editingOrgUnit ? 'Update Org Unit' : 'Create Org Unit'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading org units...</p>
        </div>
      ) : orgUnits.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No org units yet</p>
            <p className="text-muted-foreground mb-4">
              Create your first org unit to start organizing your company
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Org Unit
            </Button>
          </CardContent>
        </Card>
      ) : filteredOrgUnits.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No org units found</p>
            <p className="text-muted-foreground mb-4">
              No org units match your search "{searchTerm}"
            </p>
            <Button onClick={() => setSearchTerm('')} variant="outline">
              Clear Search
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="flex flex-col">
          <CardHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardDescription>
                {searchTerm
                  ? `Org Units (${filteredOrgUnits.length} of ${orgUnits.length})`
                  : `All Org Units (${orgUnits.length})`
                }
              </CardDescription>
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'tree')}>
                <TabsList>
                  <TabsTrigger value="list">
                    <List className="w-4 h-4 mr-2" />
                    List View
                  </TabsTrigger>
                  <TabsTrigger value="tree">
                    <Network className="w-4 h-4 mr-2" />
                    Tree View
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex flex-col">
            {viewMode === 'tree' ? (
              <div className="p-6 overflow-auto">
                <OrgUnitTreeView orgUnits={orgUnits} />
              </div>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Parent Org Unit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrgUnits.map((orgUnit) => (
                      <TableRow key={orgUnit.id}>
                        <TableCell className="font-medium">{orgUnit.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{orgUnit.code}</Badge>
                        </TableCell>
                        <TableCell>{getParentOrgUnitName(orgUnit.parentOrgUnitId)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              orgUnit.status === 'active'
                                ? 'default'
                                : orgUnit.status === 'inactive'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {orgUnit.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(orgUnit)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(orgUnit)}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmationDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, orgUnit: null })}
        title="Archive Org Unit"
        description={`Are you sure you want to archive "${deleteDialog.orgUnit?.name}"? This action cannot be undone.`}
        confirmText="Archive"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}

