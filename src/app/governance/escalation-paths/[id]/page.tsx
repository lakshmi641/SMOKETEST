'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import {
  getEscalationPath,
  createEscalationPath,
  updateEscalationPath,
  validateEscalationPath,
  getEscalationPathTemplates,
  createFromTemplate,
} from '@/lib/services/escalation-path-service'
import { UserSelect } from '@/components/features/users/UserSelect'
import { PositionSelect } from '@/components/features/org/PositionSelect'
import { RoleSelect } from '@/components/features/access-control/RoleSelect'
import {
  EscalationPath,
  EscalationResolutionType,
  EscalationRule,
  EscalationTarget,
  EscalationHierarchyConfig,
  EscalationPathSettings,
  EscalationTriggerType,
  EscalationAction,
  NotificationChannel,
  DEFAULT_ESCALATION_PATH_SETTINGS,
  DEFAULT_ESCALATION_HIERARCHY_CONFIG,
  EscalationPathStatus,
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
  AlertCircle,
  Bell,
  Clock,
  Mail,
  Smartphone,
  GripVertical,
  Copy,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function EscalationPathEditorPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { companyId, groupId } = useCompany()
  const { user } = useAuthStore()
  const isNew = params.id === 'new'
  const showTemplates = searchParams.get('template') === 'true'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [templateDialogOpen, setTemplateDialogOpen] = useState(showTemplates)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [resolutionType, setResolutionType] = useState<EscalationResolutionType>('hierarchy')
  const [hierarchyConfig, setHierarchyConfig] = useState<EscalationHierarchyConfig>(
    DEFAULT_ESCALATION_HIERARCHY_CONFIG
  )
  const [customTargets, setCustomTargets] = useState<EscalationTarget[]>([])
  const [rules, setRules] = useState<EscalationRule[]>([])
  const [settings, setSettings] = useState<EscalationPathSettings>(DEFAULT_ESCALATION_PATH_SETTINGS)
  const [status, setStatus] = useState<EscalationPathStatus>('draft')

  const templates = getEscalationPathTemplates()

  useEffect(() => {
    if (companyId) {
      if (!isNew) {
        loadEscalationPath()
      } else if (isNew && !showTemplates) {
        // Add default rule for new escalation paths
        addRule()
      }
    }
  }, [companyId, isNew])

  const loadEscalationPath = async () => {
    if (!companyId || isNew) return

    try {
      setLoading(true)
      const path = await getEscalationPath(companyId, params.id as string, groupId ?? undefined)
      if (path) {
        setName(path.name)
        setDescription(path.description || '')
        setCategory(path.category || '')
        setResolutionType(path.resolutionType)
        setHierarchyConfig({
          ...DEFAULT_ESCALATION_HIERARCHY_CONFIG,
          ...(path.hierarchyConfig as any),
        })
        setCustomTargets((path.customTargets || []).map((t, i) => ({
          ...t,
          id: t.id || `target-${i}`,
          name: t.name || '',
          value: t.value || '',
        })))
        setRules((path.rules || []).map((r, i) => ({
          ...r,
          id: r.id || `rule-${i}`,
          name: r.name || '',
        })))
        setSettings({ ...DEFAULT_ESCALATION_PATH_SETTINGS, ...path.settings })
        setStatus(path.status || 'draft')
      } else {
        toast.error('Escalation path not found')
        router.push('/governance/escalation-paths')
      }
    } catch (error) {
      console.error('Error loading escalation path:', error)
      toast.error('Failed to load escalation path')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTemplate = async (templateIndex: number) => {
    if (!companyId || !user) return

    try {
      setSaving(true)
      const path = await createFromTemplate(companyId, templateIndex, user.id, undefined, groupId ?? undefined)
      toast.success('Escalation path created from template')
      router.push(`/governance/escalation-paths/${path.id}`)
    } catch (error) {
      console.error('Error creating from template:', error)
      toast.error('Failed to create from template')
    } finally {
      setSaving(false)
      setTemplateDialogOpen(false)
    }
  }

  const addRule = () => {
    const newRule: EscalationRule = {
      id: `rule-${Date.now()}`,
      order: rules.length + 1,
      triggerType: 'time',
      triggerAfterHours: 24,
      action: 'notify',
      notificationChannels: ['in_app', 'email'],
      includeApprovalHistory: false,
      repeatIfNotActioned: false,
    }
    setRules([...rules, newRule])
  }

  const removeRule = (ruleId: string) => {
    if (rules.length <= 1) {
      toast.error('At least one rule is required')
      return
    }
    setRules(rules.filter((r) => r.id !== ruleId))
  }

  const updateRule = (ruleId: string, updates: Partial<EscalationRule>) => {
    setRules(rules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r)))
  }

  const addCustomTarget = () => {
    const newTarget: EscalationTarget = {
      id: `target-${Date.now()}`,
      level: customTargets.length + 1,
      type: 'hierarchy_next',
      name: `Level ${customTargets.length + 1}`,
      notificationChannels: ['in_app', 'email'],
    }
    setCustomTargets([...customTargets, newTarget])
  }

  const removeCustomTarget = (targetId: string) => {
    setCustomTargets(customTargets.filter((t) => t.id !== targetId))
  }

  const updateCustomTarget = (targetId: string, updates: Partial<EscalationTarget>) => {
    setCustomTargets(
      customTargets.map((t) => (t.id === targetId ? { ...t, ...updates } : t))
    )
  }

  const toggleNotificationChannel = (
    ruleId: string,
    channel: NotificationChannel
  ) => {
    const rule = rules.find((r) => r.id === ruleId)
    if (!rule) return

    const channels = rule.notificationChannels || []
    const newChannels = channels.includes(channel)
      ? channels.filter((c) => c !== channel)
      : [...channels, channel]

    updateRule(ruleId, { notificationChannels: newChannels })
  }

  const handleSave = async () => {
    if (!companyId || !user) return

    // Build escalation path object for validation
    const escalationPath: EscalationPath = {
      id: isNew ? '' : (params.id as string),
      companyId,
      name,
      description,
      category,
      resolutionType,
      hierarchyConfig: resolutionType !== 'custom' ? hierarchyConfig : undefined,
      customTargets: resolutionType !== 'hierarchy' ? customTargets : undefined,
      rules,
      settings,
      status,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.id,
    }

    // Validate
    const validation = await validateEscalationPath(companyId, escalationPath)
    if (!validation.valid) {
      setValidationErrors(validation.errors)
      toast.error('Please fix validation errors')
      return
    }

    try {
      setSaving(true)
      setValidationErrors([])

      if (isNew) {
        await createEscalationPath(
          companyId,
          {
            name,
            description,
            category,
            resolutionType,
            hierarchyConfig: resolutionType !== 'custom' ? hierarchyConfig : undefined,
            customTargets: resolutionType !== 'hierarchy' ? customTargets : undefined,
            rules,
            settings,
            status,
          },
          user.id,
          groupId ?? undefined
        )
        toast.success('Escalation path created')
      } else {
        await updateEscalationPath(
          companyId,
          params.id as string,
          {
            name,
            description,
            category,
            resolutionType,
            hierarchyConfig: resolutionType !== 'custom' ? hierarchyConfig : undefined,
            customTargets: resolutionType !== 'hierarchy' ? customTargets : undefined,
            rules,
            settings,
            status,
          },
          user.id,
          groupId ?? undefined
        )
        toast.success('Escalation path updated')
      }

      router.push('/governance/escalation-paths')
    } catch (error) {
      console.error('Error saving escalation path:', error)
      toast.error('Failed to save escalation path')
    } finally {
      setSaving(false)
    }
  }

  const getTriggerTypeLabel = (type: EscalationTriggerType) => {
    switch (type) {
      case 'time':
        return 'Time-based'
      case 'reminder_count':
        return 'After N reminders'
      case 'rejection':
        return 'On rejection'
      case 'no_response':
        return 'No response'
      case 'partial_approval':
        return 'Partial approval'
      case 'condition':
        return 'Custom condition'
      default:
        return type
    }
  }

  const getActionLabel = (action: EscalationAction) => {
    switch (action) {
      case 'notify':
        return 'Send notification'
      case 'remind':
        return 'Send reminder'
      case 'reassign':
        return 'Reassign approval'
      case 'escalate':
        return 'Escalate to next level'
      case 'add_approver':
        return 'Add additional approver'
      case 'auto_approve':
        return 'Auto approve'
      case 'auto_reject':
        return 'Auto reject'
      case 'cancel':
        return 'Cancel approval'
      default:
        return action
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
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Template Dialog */}
        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Select Template</DialogTitle>
              <DialogDescription>
                Choose a pre-built escalation path template to get started quickly
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {templates.map((template, index) => (
                <Card
                  key={index}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleSelectTemplate(index)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Bell className="h-4 w-4" />
                        <span>{template.rules.length} rules</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>Max {template.settings.maxEscalations} escalations</span>
                      </div>
                      <Badge variant="outline">{template.category}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                Start from scratch
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/governance/escalation-paths">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {isNew ? 'New Escalation Path' : 'Edit Escalation Path'}
              </h1>
              <p className="text-muted-foreground">
                Configure escalation rules and targets
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
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
            <TabsTrigger value="rules">
              <Bell className="mr-2 h-4 w-4" />
              Rules
            </TabsTrigger>
            <TabsTrigger value="targets">
              <Users className="mr-2 h-4 w-4" />
              Targets
            </TabsTrigger>
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
                <CardDescription>General details about this escalation path</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto pb-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Standard Escalation"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g., general, urgent, rejection"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div className="space-y-0.5">
                    <Label>Status</Label>
                    <p className="text-sm text-muted-foreground">
                      Only Active escalation paths can be linked to approval stages
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
                    placeholder="Describe when this escalation path should be used..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Resolution Type *</Label>
                  <Select
                    value={resolutionType}
                    onValueChange={(v) => setResolutionType(v as EscalationResolutionType)}
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
                          <span>Custom Targets</span>
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rules Tab */}
          <TabsContent value="rules" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Escalation Rules</CardTitle>
                    <CardDescription>
                      Define when and how escalations are triggered
                    </CardDescription>
                  </div>
                  <Button onClick={addRule} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Rule
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {rules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bell className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No escalation rules defined</p>
                    <Button className="mt-4" variant="outline" onClick={addRule}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add First Rule
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pb-4">
                    {rules.map((rule, index) => (
                      <div key={rule.id} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                            <Badge variant="outline">Rule {index + 1}</Badge>
                            <Input
                              value={rule.name || ''}
                              onChange={(e) =>
                                updateRule(rule.id, { name: e.target.value })
                              }
                              className="w-48"
                              placeholder="Rule name (optional)"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRule(rule.id)}
                            disabled={rules.length <= 1}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="space-y-2">
                            <Label>Trigger Type</Label>
                            <Select
                              value={rule.triggerType}
                              onValueChange={(v) =>
                                updateRule(rule.id, { triggerType: v as EscalationTriggerType })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="time">Time-based</SelectItem>
                                <SelectItem value="reminder_count">After N reminders</SelectItem>
                                <SelectItem value="rejection">On rejection</SelectItem>
                                <SelectItem value="no_response">No response</SelectItem>
                                <SelectItem value="partial_approval">Partial approval</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {(rule.triggerType === 'time' || rule.triggerType === 'no_response') && (
                            <div className="space-y-2">
                              <Label>After (hours)</Label>
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={rule.triggerAfterHours !== undefined ? rule.triggerAfterHours : ''}
                                onChange={(e) =>
                                  updateRule(rule.id, {
                                    triggerAfterHours: e.target.value === '' ? undefined : parseFloat(e.target.value),
                                  })
                                }
                              />
                            </div>
                          )}

                          {rule.triggerType === 'reminder_count' && (
                            <div className="space-y-2">
                              <Label>After N reminders</Label>
                              <Input
                                type="number"
                                min={1}
                                value={rule.triggerAfterReminders || ''}
                                onChange={(e) =>
                                  updateRule(rule.id, {
                                    triggerAfterReminders: parseInt(e.target.value) || undefined,
                                  })
                                }
                              />
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label>Action</Label>
                            <Select
                              value={rule.action}
                              onValueChange={(v) =>
                                updateRule(rule.id, { action: v as EscalationAction })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="notify">Send notification</SelectItem>
                                <SelectItem value="remind">Send reminder</SelectItem>
                                <SelectItem value="escalate">Escalate to next level</SelectItem>
                                <SelectItem value="reassign">Reassign approval</SelectItem>
                                <SelectItem value="add_approver">Add approver</SelectItem>
                                <SelectItem value="auto_approve">Auto approve</SelectItem>
                                <SelectItem value="auto_reject">Auto reject</SelectItem>
                                <SelectItem value="cancel">Cancel</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {rule.action === 'escalate' && (
                          <div className="space-y-2">
                            <Label>Target Level</Label>
                            <Input
                              type="number"
                              min={1}
                              value={rule.targetLevel || ''}
                              onChange={(e) =>
                                updateRule(rule.id, {
                                  targetLevel: parseInt(e.target.value) || undefined,
                                })
                              }
                              className="w-24"
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label>Notification Channels</Label>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`${rule.id}-in_app`}
                                checked={rule.notificationChannels?.includes('in_app')}
                                onCheckedChange={() =>
                                  toggleNotificationChannel(rule.id, 'in_app')
                                }
                              />
                              <Label htmlFor={`${rule.id}-in_app`} className="text-sm font-normal">
                                <Bell className="h-4 w-4 inline mr-1" />
                                In-App
                              </Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`${rule.id}-email`}
                                checked={rule.notificationChannels?.includes('email')}
                                onCheckedChange={() =>
                                  toggleNotificationChannel(rule.id, 'email')
                                }
                              />
                              <Label htmlFor={`${rule.id}-email`} className="text-sm font-normal">
                                <Mail className="h-4 w-4 inline mr-1" />
                                Email
                              </Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`${rule.id}-push`}
                                checked={rule.notificationChannels?.includes('push')}
                                onCheckedChange={() =>
                                  toggleNotificationChannel(rule.id, 'push')
                                }
                              />
                              <Label htmlFor={`${rule.id}-push`} className="text-sm font-normal">
                                <Smartphone className="h-4 w-4 inline mr-1" />
                                Push
                              </Label>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Message Template (optional)</Label>
                          <Textarea
                            value={rule.messageTemplate || ''}
                            onChange={(e) =>
                              updateRule(rule.id, { messageTemplate: e.target.value })
                            }
                            placeholder="Custom message template. Use {{resourceTitle}} for variables."
                            rows={2}
                          />
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.includeApprovalHistory}
                              onCheckedChange={(v) =>
                                updateRule(rule.id, { includeApprovalHistory: v })
                              }
                            />
                            <Label className="text-sm font-normal">Include approval history</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.repeatIfNotActioned}
                              onCheckedChange={(v) =>
                                updateRule(rule.id, { repeatIfNotActioned: v })
                              }
                            />
                            <Label className="text-sm font-normal">Repeat if not actioned</Label>
                          </div>
                        </div>

                        {rule.repeatIfNotActioned && (
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Repeat Interval (hours)</Label>
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={rule.repeatIntervalHours !== undefined ? rule.repeatIntervalHours : ''}
                                onChange={(e) =>
                                  updateRule(rule.id, {
                                    repeatIntervalHours: e.target.value === '' ? undefined : parseFloat(e.target.value),
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Max Repeats</Label>
                              <Input
                                type="number"
                                min={1}
                                value={rule.maxRepeats || ''}
                                onChange={(e) =>
                                  updateRule(rule.id, {
                                    maxRepeats: parseInt(e.target.value) || undefined,
                                  })
                                }
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Targets Tab */}
          <TabsContent value="targets" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Escalation Targets</CardTitle>
                    <CardDescription>
                      Define who receives escalated approvals at each level
                    </CardDescription>
                  </div>
                  {resolutionType !== 'hierarchy' && (
                    <Button onClick={addCustomTarget} size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Target
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {resolutionType === 'hierarchy' ? (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pb-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Escalate to Manager</Label>
                        <p className="text-sm text-muted-foreground">
                          Escalate to the next level up in the reporting chain
                        </p>
                      </div>
                      <Switch
                        checked={hierarchyConfig.escalateToManager}
                        onCheckedChange={(v) =>
                          setHierarchyConfig({ ...hierarchyConfig, escalateToManager: v })
                        }
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Max Levels</Label>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={hierarchyConfig.maxLevels}
                          onChange={(e) =>
                            setHierarchyConfig({
                              ...hierarchyConfig,
                              maxLevels: parseInt(e.target.value) || 3,
                            })
                          }
                        />
                        <p className="text-sm text-muted-foreground">
                          Maximum escalation levels in the hierarchy
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Skip Vacant Positions</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically skip to next level if position is vacant
                        </p>
                      </div>
                      <Switch
                        checked={hierarchyConfig.skipVacantPositions}
                        onCheckedChange={(v) =>
                          setHierarchyConfig({ ...hierarchyConfig, skipVacantPositions: v })
                        }
                      />
                    </div>
                  </div>
                ) : customTargets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No custom targets defined</p>
                    <Button className="mt-4" variant="outline" onClick={addCustomTarget}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add First Target
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pb-4">
                    {customTargets.map((target) => (
                      <div
                        key={target.id}
                        className="flex items-center gap-4 p-4 border rounded-lg"
                      >
                        <Badge variant="outline">Level {target.level}</Badge>
                        <div className="flex-1 grid gap-4 sm:grid-cols-3">
                          <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                              value={target.type}
                              onValueChange={(v) =>
                                updateCustomTarget(target.id, { type: v as any })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="hierarchy_next">Next in hierarchy</SelectItem>
                                <SelectItem value="user">Specific user</SelectItem>
                                <SelectItem value="position">Position</SelectItem>
                                <SelectItem value="role">Role</SelectItem>
                                <SelectItem value="department_head">Department head</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                              value={target.name || ''}
                              onChange={(e) =>
                                updateCustomTarget(target.id, { name: e.target.value })
                              }
                              placeholder="Display name"
                            />
                          </div>
                          {target.type !== 'hierarchy_next' &&
                            target.type !== 'admin' &&
                            target.type !== 'department_head' && (
                              <div className="space-y-2">
                                <Label>Value</Label>
                                {target.type === 'user' ? (
                                  <UserSelect
                                    value={target.value || ''}
                                    onValueChange={(v, user) => {
                                      updateCustomTarget(target.id, {
                                        value: v,
                                        name: user ? user.name : target.name
                                      })
                                    }}
                                  />
                                ) : target.type === 'position' ? (
                                  <PositionSelect
                                    value={target.value || ''}
                                    onValueChange={(v, pos) => {
                                      updateCustomTarget(target.id, {
                                        value: v,
                                        name: pos ? pos.title : target.name
                                      })
                                    }}
                                  />
                                ) : target.type === 'role' ? (
                                  <RoleSelect
                                    value={target.value || ''}
                                    onValueChange={(v, role) => {
                                      updateCustomTarget(target.id, {
                                        value: v,
                                        name: role ? role.name : target.name
                                      })
                                    }}
                                  />
                                ) : (
                                  <Input
                                    value={target.value || ''}
                                    onChange={(e) =>
                                      updateCustomTarget(target.id, { value: e.target.value })
                                    }
                                    placeholder="Value"
                                  />
                                )}
                              </div>
                            )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCustomTarget(target.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Escalation Settings</CardTitle>
                <CardDescription>Configure global settings for this escalation path</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 max-h-[60vh] overflow-y-auto pb-6">
                <div className="space-y-2">
                  <Label>Maximum Escalations</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={settings.maxEscalations || 3}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maxEscalations: parseInt(e.target.value) || 3,
                      })
                    }
                    className="w-32"
                  />
                  <p className="text-sm text-muted-foreground">
                    Maximum times to escalate before taking final action
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Final Action</Label>
                  <Select
                    value={settings.finalAction}
                    onValueChange={(v) =>
                      setSettings({ ...settings, finalAction: v as any })
                    }
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto_approve">Auto Approve</SelectItem>
                      <SelectItem value="auto_reject">Auto Reject</SelectItem>
                      <SelectItem value="notify_admin">Notify Admin</SelectItem>
                      <SelectItem value="cancel">Cancel</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Action to take when maximum escalations is reached
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notify Original Approver</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify the original approver when escalation occurs
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifyOriginalApprover}
                    onCheckedChange={(v) =>
                      setSettings({ ...settings, notifyOriginalApprover: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notify Requester</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify the requester when escalation occurs
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifyRequester}
                    onCheckedChange={(v) =>
                      setSettings({ ...settings, notifyRequester: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Track Escalation History</Label>
                    <p className="text-sm text-muted-foreground">
                      Keep detailed history of all escalation events
                    </p>
                  </div>
                  <Switch
                    checked={settings.trackEscalationHistory}
                    onCheckedChange={(v) =>
                      setSettings({ ...settings, trackEscalationHistory: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notify on Final Action</Label>
                    <p className="text-sm text-muted-foreground">
                      Send notification when the final action is taken
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifyOnFinalAction}
                    onCheckedChange={(v) =>
                      setSettings({ ...settings, notifyOnFinalAction: v })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
