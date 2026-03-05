'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import {
  getApprovalLine,
  createApprovalLine,
  updateApprovalLine,
  validateApprovalLine,
  previewApprovalLineConfig,
} from '@/lib/services/approval-line-service'
import { getActiveEscalationPaths } from '@/lib/services/escalation-path-service'
import { UserSelect } from '@/components/features/users/UserSelect'
import { PositionSelect } from '@/components/features/org/PositionSelect'
import { RoleSelect } from '@/components/features/access-control/RoleSelect'
import {
  ApprovalLine,
  ApprovalResolutionType,
  ApprovalStageDefinition,
  HierarchyConfig,
  CustomApprover,
  ApprovalLineSettings,
  BudgetThreshold,
  DEFAULT_APPROVAL_LINE_SETTINGS,
  DEFAULT_HIERARCHY_CONFIG,
  ApprovalLineResolution,
  EscalationPath,
  ApprovalLineStatus,
} from '@/types/approval-line-schema'
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  GitBranch,
  Users,
  Settings,
  Play,
  AlertCircle,
  CheckCircle,
  GripVertical,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function ApprovalLineEditorPage() {
  const router = useRouter()
  const params = useParams()
  const { companyId, groupId } = useCompany()
  const { user } = useAuthStore()
  const isNew = params.id === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [escalationPaths, setEscalationPaths] = useState<EscalationPath[]>([])
  const [testResult, setTestResult] = useState<ApprovalLineResolution | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Test state
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testRequesterId, setTestRequesterId] = useState('')
  const [testAmount, setTestAmount] = useState(10000)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [resolutionType, setResolutionType] = useState<ApprovalResolutionType>('hierarchy')
  const [hierarchyConfig, setHierarchyConfig] = useState<HierarchyConfig>(DEFAULT_HIERARCHY_CONFIG)
  const [customApprovers, setCustomApprovers] = useState<CustomApprover[]>([])
  const [stages, setStages] = useState<ApprovalStageDefinition[]>([])
  const [settings, setSettings] = useState<ApprovalLineSettings>(DEFAULT_APPROVAL_LINE_SETTINGS)
  const [status, setStatus] = useState<ApprovalLineStatus>('draft')
  const [escalationPathId, setEscalationPathId] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (user && !testRequesterId) {
      setTestRequesterId(user.id)
    }
  }, [user])

  useEffect(() => {
    if (companyId) {
      loadEscalationPaths()
      if (!isNew) {
        loadApprovalLine()
      } else {
        // Add default stage for new approval lines
        addStage()
      }
    }
  }, [companyId, isNew])

  const loadApprovalLine = async () => {
    if (!companyId || isNew) return

    try {
      setLoading(true)
      const line = await getApprovalLine(companyId, params.id as string, groupId ?? undefined)
      if (line) {
        setName(line.name)
        setDescription(line.description || '')
        setCategory(line.category || '')
        setResolutionType(line.resolutionType)
        setHierarchyConfig({ ...DEFAULT_HIERARCHY_CONFIG, ...line.hierarchyConfig })
        setCustomApprovers((line.customApprovers || []).map((a: any) => ({
          id: `approver-${Math.random()}`,
          type: 'user',
          value: '',
          name: '',
          ...a
        })))
        setStages((line.stages || []).map((s: any, i: number) => ({
          id: `stage-${i}`,
          name: `Stage ${i + 1}`,
          timeoutHours: line.settings?.defaultTimeoutHours || 48,
          requiredApprovals: 1,
          ...s
        })))
        setSettings({ ...DEFAULT_APPROVAL_LINE_SETTINGS, ...line.settings })
        setStatus(line.status || 'draft')
        setEscalationPathId((line as any).escalationPathId || undefined)
      } else {
        toast.error('Approval line not found')
        router.push('/governance/approval-lines')
      }
    } catch (error) {
      console.error('Error loading approval line:', error)
      toast.error('Failed to load approval line')
    } finally {
      setLoading(false)
    }
  }

  const loadEscalationPaths = async () => {
    if (!companyId) return
    try {
      const paths = await getActiveEscalationPaths(companyId, groupId ?? undefined)
      setEscalationPaths(paths)
    } catch (error) {
      console.error('Error loading escalation paths:', error)
    }
  }

  const addStage = () => {
    const newStage: ApprovalStageDefinition = {
      id: `stage-${Date.now()}`,
      name: `Stage ${stages.length + 1}`,
      order: stages.length + 1,
      type: 'sequential',
      approverSource: resolutionType === 'custom' ? 'custom' : 'hierarchy',
      hierarchyLevel: 1,
      requiredApprovals: 1,
      allowPartialCompletion: false,
      timeoutHours: settings.defaultTimeoutHours,
      onApprove: 'next_stage',
      onReject: 'reject_all',
      onTimeout: 'next_stage',
    }
    setStages([...stages, newStage])
  }

  const removeStage = (stageId: string) => {
    if (stages.length <= 1) {
      toast.error('At least one stage is required')
      return
    }
    setStages(stages.filter((s) => s.id !== stageId))
  }

  const updateStage = (stageId: string, updates: Partial<ApprovalStageDefinition>) => {
    setStages(
      stages.map((s) => (s.id === stageId ? { ...s, ...updates } : s))
    )
  }

  const addCustomApprover = () => {
    const newApprover: CustomApprover = {
      id: `approver-${Date.now()}`,
      type: 'user',
      value: '',
      name: '',
      order: customApprovers.length + 1,
      isRequired: true,
      canDelegate: true,
      canBeSkipped: false,
    }
    setCustomApprovers([...customApprovers, newApprover])
  }

  const removeCustomApprover = (approverId: string) => {
    setCustomApprovers(customApprovers.filter((a) => a.id !== approverId))
  }

  const updateCustomApprover = (approverId: string, updates: Partial<CustomApprover>) => {
    setCustomApprovers(
      customApprovers.map((a) => (a.id === approverId ? { ...a, ...updates } : a))
    )
  }

  const handleSave = async () => {
    if (!companyId || !user) return

    // Build approval line object for validation
    const approvalLine: ApprovalLine = {
      id: isNew ? '' : (params.id as string),
      companyId,
      name,
      description,
      category,
      resolutionType,
      hierarchyConfig: resolutionType !== 'custom' ? hierarchyConfig : undefined,
      customApprovers: resolutionType !== 'hierarchy' ? customApprovers : undefined,
      stages,
      settings,
      status,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.id,
    }

    // Validate
    const validation = await validateApprovalLine(companyId, approvalLine)
    if (!validation.valid) {
      setValidationErrors(validation.errors)
      toast.error('Please fix validation errors')
      return
    }

    try {
      setSaving(true)
      setValidationErrors([])

      if (isNew) {
        await createApprovalLine(
          companyId,
          {
            name,
            description,
            category,
            resolutionType,
            hierarchyConfig: resolutionType !== 'custom' ? hierarchyConfig : undefined,
            customApprovers: resolutionType !== 'hierarchy' ? customApprovers : undefined,
            stages,
            settings,
            status,
            escalationPathId,
          },
          user.id,
          groupId ?? undefined
        )
        toast.success('Approval line created')
      } else {
        await updateApprovalLine(
          companyId,
          params.id as string,
          {
            name,
            description,
            category,
            resolutionType,
            hierarchyConfig: resolutionType !== 'custom' ? hierarchyConfig : undefined,
            customApprovers: resolutionType !== 'hierarchy' ? customApprovers : undefined,
            stages,
            settings,
            status,
            escalationPathId,
          },
          user.id,
          groupId ?? undefined
        )
        toast.success('Approval line updated')
      }

      router.push('/governance/approval-lines')
    } catch (error) {
      console.error('Error saving approval line:', error)
      toast.error('Failed to save approval line')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenTest = () => {
    setTestDialogOpen(true)
  }

  const handleTest = async () => {
    if (!companyId) return

    // Build approval line object for testing current form state
    const approvalLine: ApprovalLine = {
      id: isNew ? 'preview' : (params.id as string),
      companyId,
      name,
      description,
      category,
      resolutionType,
      hierarchyConfig,
      customApprovers,
      stages,
      settings,
      status: 'active', // Force active for testing
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user?.id || 'system',
    }

    try {
      setTesting(true)
      setTestResult(null)

      const result = await previewApprovalLineConfig(companyId, approvalLine, {
        requesterId: testRequesterId || user?.id,
        resourceType: 'custom',
        resourceId: 'test',
        amount: testAmount,
      })

      setTestResult(result)
      setTestDialogOpen(false)
      toast.success('Resolution test completed')

      // Scroll to results after a short delay
      setTimeout(() => {
        const resultsEl = document.getElementById('test-results')
        if (resultsEl) {
          resultsEl.scrollIntoView({ behavior: 'smooth' })
        }
      }, 300)
    } catch (error) {
      console.error('Error testing approval line:', error)
      toast.error('Failed to test approval line')
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/governance/approval-lines">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {isNew ? 'New Approval Line' : 'Edit Approval Line'}
              </h1>
              <p className="text-muted-foreground">
                Configure approval chain and escalation rules
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleOpenTest} disabled={testing}>
              {testing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Test Resolution
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Validation Errors</p>
                  <ul className="mt-2 list-disc list-inside text-sm text-muted-foreground">
                    {validationErrors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="hierarchy">
              <GitBranch className="mr-2 h-4 w-4" />
              Hierarchy
            </TabsTrigger>
            <TabsTrigger value="approvers">
              <Users className="mr-2 h-4 w-4" />
              Custom Approvers
            </TabsTrigger>
            <TabsTrigger value="stages">Stages</TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>General details about this approval line</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto pb-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Purchase Order Approval"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g., finance, hr, operations"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div className="space-y-0.5">
                    <Label>Status</Label>
                    <p className="text-sm text-muted-foreground">
                      Only Active approval lines can be linked to workflows
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={status === 'active' ? 'default' : 'secondary'}>
                      {status === 'active' ? 'Active' : 'Draft'}
                    </Badge>
                    <Switch
                      checked={status === 'active'}
                      onCheckedChange={(v) => setStatus(v ? 'active' : 'draft')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe when this approval line should be used..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Resolution Type *</Label>
                  <Select
                    value={resolutionType}
                    onValueChange={(v) => setResolutionType(v as ApprovalResolutionType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hierarchy">
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4" />
                          <span>Organization Hierarchy</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="custom">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span>Custom Approvers</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="mixed">
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4" />
                          <span>Mixed (Hierarchy + Custom)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {resolutionType === 'hierarchy' &&
                      'Approvers are determined by the organization hierarchy (manager chain)'}
                    {resolutionType === 'custom' &&
                      'Approvers are specifically defined users or positions'}
                    {resolutionType === 'mixed' &&
                      'Combine hierarchy-based and custom approvers'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hierarchy Tab */}
          <TabsContent value="hierarchy" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Hierarchy Configuration</CardTitle>
                <CardDescription>
                  Configure how approvers are resolved from the organization hierarchy
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto pb-4">
                {resolutionType === 'custom' ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <GitBranch className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>Hierarchy configuration is not used when resolution type is "Custom Approvers"</p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Start From</Label>
                        <Select
                          value={hierarchyConfig.startFrom}
                          onValueChange={(v) =>
                            setHierarchyConfig({ ...hierarchyConfig, startFrom: v as any })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="requester">Requester's Position</SelectItem>
                            <SelectItem value="position">Specific Position</SelectItem>
                            <SelectItem value="department_head">Department Head</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Levels Up</Label>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={hierarchyConfig.levelsUp}
                          onChange={(e) =>
                            setHierarchyConfig({
                              ...hierarchyConfig,
                              levelsUp: parseInt(e.target.value) || 1,
                            })
                          }
                        />
                        <p className="text-sm text-muted-foreground">
                          How many levels up the reporting chain to traverse
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Skip Vacant Positions</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically skip to the next level if a position is vacant
                        </p>
                      </div>
                      <Switch
                        checked={hierarchyConfig.skipVacantPositions}
                        onCheckedChange={(v) =>
                          setHierarchyConfig({ ...hierarchyConfig, skipVacantPositions: v })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Vacant Position Fallback</Label>
                      <Select
                        value={hierarchyConfig.vacantPositionFallback}
                        onValueChange={(v) =>
                          setHierarchyConfig({
                            ...hierarchyConfig,
                            vacantPositionFallback: v as any,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">Skip to next level</SelectItem>
                          <SelectItem value="escalate_next">Escalate immediately</SelectItem>
                          <SelectItem value="notify_admin">Notify admin</SelectItem>
                          <SelectItem value="fail">Fail (require manual assignment)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Custom Approvers Tab */}
          <TabsContent value="approvers" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Custom Approvers</CardTitle>
                    <CardDescription>
                      Define specific users or positions as approvers
                    </CardDescription>
                  </div>
                  <Button onClick={addCustomApprover} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Approver
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {resolutionType === 'hierarchy' ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>Custom approvers are not used when resolution type is "Organization Hierarchy"</p>
                  </div>
                ) : customApprovers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No custom approvers defined</p>
                    <Button className="mt-4" variant="outline" onClick={addCustomApprover}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add First Approver
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pb-4">
                    {customApprovers.map((approver, index) => (
                      <div
                        key={approver.id}
                        className="flex items-center gap-4 p-4 border rounded-lg"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                        <div className="flex-1 grid gap-4 sm:grid-cols-3">
                          <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                              value={approver.type}
                              onValueChange={(v) =>
                                updateCustomApprover(approver.id, { type: v as any })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">Specific User</SelectItem>
                                <SelectItem value="position">Position</SelectItem>
                                <SelectItem value="role">Role</SelectItem>
                                <SelectItem value="external">External Email</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                              value={approver.name || ''}
                              onChange={(e) =>
                                updateCustomApprover(approver.id, { name: e.target.value })
                              }
                              placeholder="Display name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Value</Label>
                            {approver.type === 'user' ? (
                              <UserSelect
                                value={approver.value || ''}
                                onValueChange={(v, user) => {
                                  updateCustomApprover(approver.id, {
                                    value: v,
                                    name: user ? user.name : approver.name
                                  })
                                }}
                              />
                            ) : approver.type === 'position' ? (
                              <PositionSelect
                                value={approver.value || ''}
                                onValueChange={(v, pos) => {
                                  updateCustomApprover(approver.id, {
                                    value: v,
                                    name: pos ? pos.title : approver.name
                                  })
                                }}
                              />
                            ) : approver.type === 'role' ? (
                              <RoleSelect
                                value={approver.value || ''}
                                onValueChange={(v, role) => {
                                  updateCustomApprover(approver.id, {
                                    value: v,
                                    name: role ? role.name : approver.name
                                  })
                                }}
                              />
                            ) : (
                              <Input
                                value={approver.value || ''}
                                onChange={(e) =>
                                  updateCustomApprover(approver.id, { value: e.target.value })
                                }
                                placeholder={
                                  approver.type === 'external'
                                    ? 'email@example.com'
                                    : 'Value'
                                }
                              />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={approver.isRequired}
                              onCheckedChange={(v) =>
                                updateCustomApprover(approver.id, { isRequired: v })
                              }
                            />
                            <Label className="text-sm">Required</Label>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCustomApprover(approver.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stages Tab */}
          <TabsContent value="stages" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Approval Stages</CardTitle>
                    <CardDescription>
                      Define the stages of the approval process
                    </CardDescription>
                  </div>
                  <Button onClick={addStage} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Stage
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="max-h-[60vh] overflow-y-auto">
                <div className="space-y-4 pb-4">
                  {stages.map((stage, index) => (
                    <div key={stage.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">Stage {index + 1}</Badge>
                          <Input
                            value={stage.name || ''}
                            onChange={(e) =>
                              updateStage(stage.id, { name: e.target.value })
                            }
                            className="w-64"
                            placeholder="Stage name"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeStage(stage.id)}
                          disabled={stages.length <= 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Stage Type</Label>
                          <Select
                            value={stage.type}
                            onValueChange={(v) =>
                              updateStage(stage.id, { type: v as any })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sequential">Sequential</SelectItem>
                              <SelectItem value="parallel">Parallel</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Timeout (hours)</Label>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={stage.timeoutHours !== undefined ? stage.timeoutHours : 24}
                            onChange={(e) =>
                              updateStage(stage.id, {
                                timeoutHours: e.target.value === '' ? 24 : parseFloat(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Required Approvals</Label>
                          <Input
                            type="number"
                            min={1}
                            value={stage.requiredApprovals || 1}
                            onChange={(e) =>
                              updateStage(stage.id, {
                                requiredApprovals: parseInt(e.target.value) || 1,
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Escalation Path</Label>
                          <Select
                            value={stage.escalationPathId || 'none'}
                            onValueChange={(v) =>
                              updateStage(stage.id, {
                                escalationPathId: v === 'none' ? undefined : v,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select escalation path" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No escalation</SelectItem>
                              {escalationPaths.map((path) => (
                                <SelectItem key={path.id} value={path.id}>
                                  {path.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Approver Source</Label>
                          <Select
                            value={stage.approverSource}
                            onValueChange={(v) =>
                              updateStage(stage.id, { approverSource: v as any })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hierarchy">From Hierarchy</SelectItem>
                              <SelectItem value="custom">From Custom Approvers</SelectItem>
                              <SelectItem value="mixed">Mixed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Approval Settings</CardTitle>
                <CardDescription>Configure global settings for this approval line</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 max-h-[60vh] overflow-y-auto pb-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Delegation</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow approvers to delegate their approval authority
                    </p>
                  </div>
                  <Switch
                    checked={settings.allowDelegation}
                    onCheckedChange={(v) =>
                      setSettings({ ...settings, allowDelegation: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Skip If Same User</Label>
                    <p className="text-sm text-muted-foreground">
                      Skip approval step if the approver is the same as the requester
                    </p>
                  </div>
                  <Switch
                    checked={settings.skipIfSameUser}
                    onCheckedChange={(v) =>
                      setSettings({ ...settings, skipIfSameUser: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require Comments</Label>
                    <p className="text-sm text-muted-foreground">
                      Require approvers to add comments when approving or rejecting
                    </p>
                  </div>
                  <Switch
                    checked={settings.requireComments}
                    onCheckedChange={(v) =>
                      setSettings({ ...settings, requireComments: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notify on Assignment</Label>
                    <p className="text-sm text-muted-foreground">
                      Send notification when approval is assigned
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifyOnAssignment}
                    onCheckedChange={(v) =>
                      setSettings({ ...settings, notifyOnAssignment: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Partial Approval</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow approvers to approve with conditions or partial amounts
                    </p>
                  </div>
                  <Switch
                    checked={settings.allowPartialApproval}
                    onCheckedChange={(v) =>
                      setSettings({ ...settings, allowPartialApproval: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notify on Completion</Label>
                    <p className="text-sm text-muted-foreground">
                      Send notification when approval is completed
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifyOnCompletion}
                    onCheckedChange={(v) =>
                      setSettings({ ...settings, notifyOnCompletion: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Send Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically send reminders to pending approvers
                    </p>
                  </div>
                  <Switch
                    checked={settings.sendReminders}
                    onCheckedChange={(v) =>
                      setSettings({ ...settings, sendReminders: v })
                    }
                  />
                </div>

                {settings.sendReminders && (
                  <div className="space-y-2">
                    <Label>Reminder Interval (hours)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={settings.reminderIntervalHours !== undefined ? settings.reminderIntervalHours : 24}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          reminderIntervalHours: e.target.value === '' ? 24 : parseFloat(e.target.value),
                        })
                      }
                      className="w-32"
                    />
                    <p className="text-sm text-muted-foreground">
                      How often to send reminders while approval is pending
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Default Timeout (hours)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={settings.defaultTimeoutHours !== undefined ? settings.defaultTimeoutHours : 48}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        defaultTimeoutHours: e.target.value === '' ? 48 : parseFloat(e.target.value),
                      })
                    }
                    className="w-32"
                  />
                  <p className="text-sm text-muted-foreground">
                    Default timeout for stages if not specified
                  </p>
                </div>

                <div className="border-t pt-6 space-y-4">
                  <div>
                    <h4 className="font-medium text-sm text-orange-600">Escalation Configuration</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Configure auto-approve, auto-reject, and escalation rules
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Default Escalation Path</Label>
                    <Select
                      value={escalationPathId || 'none'}
                      onValueChange={(v) => setEscalationPathId(v === 'none' ? undefined : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select escalation path" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No default escalation</SelectItem>
                        {escalationPaths.map((path) => (
                          <SelectItem key={path.id} value={path.id}>
                            {path.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Default escalation path for all stages. Stages can override with their own escalation path.
                      <br />
                      <span className="text-orange-600 font-medium">
                        Required for auto-approve/auto-reject to work!
                      </span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Test Results */}
        {testResult && (
          <Card id="test-results" className="scroll-mt-6 border-blue-200 bg-blue-50/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-blue-500" />
                Resolution Test Results
              </CardTitle>
              <CardDescription>
                Resolved {testResult.totalApprovers} approvers across {testResult.totalStages} stages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {testResult.stages.map((stage) => (
                  <div key={stage.stageId} className="border rounded-lg p-4 bg-background">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{stage.stageName}</h4>
                      <Badge variant={stage.wasSkipped ? 'secondary' : 'default'}>
                        {stage.wasSkipped ? 'Skipped' : `${stage.approvers.length} approvers`}
                      </Badge>
                    </div>
                    {stage.wasSkipped ? (
                      <p className="text-sm text-muted-foreground italic">
                        Reason: {stage.skipReason}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {stage.approvers.map((approver, idx) => (
                          <div
                            key={`${approver.userId}-${idx}`}
                            className="flex items-center gap-3 text-sm p-2 rounded-md hover:bg-muted/50"
                          >
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <div className="flex flex-col">
                              <span className="font-medium">{approver.positionTitle || 'Unknown Position'}</span>
                              <span className="text-xs text-muted-foreground">{approver.userId}</span>
                            </div>
                            {approver.isDelegated && (
                              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                                Delegated
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {testResult.warnings.length > 0 && (
                  <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="font-medium text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Warnings
                    </p>
                    <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside">
                      {testResult.warnings.map((warning, i) => (
                        <li key={i}>{warning.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Test Resolution</DialogTitle>
              <DialogDescription>
                Test how this approval line resolves with specific parameters
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Requester (Context Person)</Label>
                <UserSelect
                  value={testRequesterId}
                  onValueChange={setTestRequesterId}
                />
                <p className="text-xs text-muted-foreground">
                  The person starting the approval process (we resolve starting from their position)
                </p>
              </div>
              <div className="space-y-2">
                <Label>Sample Amount (for threshold rules)</Label>
                <Input
                  type="number"
                  step="any"
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Used if any stages have conditions based on 'amount'
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleTest} disabled={testing}>
                {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Run Test
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
