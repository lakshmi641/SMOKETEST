'use client'

import { useState, useEffect } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { WorkflowLifecycleService } from '@/lib/services/workflow-lifecycle-service'
import { WorkflowDefinition } from '@/types/workflow-schema'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Network,
  Plus,
  Search,
  GitBranch,
  Play,
  Settings2,
  Trash2,
  History,
  ChevronRight,
  ShieldCheck,
  Zap,
  CheckCircle2,
  FileCode,
  ArrowLeft,
  Eye
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { WorkflowModeler } from '@/components/Workflow/WorkflowModeler'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'

export default function WorkflowDefinitionsPage() {
  const { companyId, groupId } = useCompany()
  const { user } = useAuthStore()
  const searchParams = useSearchParams()
  const initialMode = searchParams.get('mode')

  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDesigning, setIsDesigning] = useState(initialMode === 'designer')
  const [selectedDefinition, setSelectedDefinition] = useState<WorkflowDefinition | undefined>(undefined)

  useEffect(() => {
    if (initialMode === 'designer' && !isDesigning) {
      setIsDesigning(true)
    }
  }, [initialMode])

  useEffect(() => {
    if (companyId && user?.id) {
      loadDefinitions()
    }
  }, [companyId, user?.id, groupId])

  const loadDefinitions = async () => {
    try {
      setLoading(true)
      const data = await WorkflowLifecycleService.getAccessibleWorkflows(companyId!, user!.id, undefined, groupId ?? undefined)
      setDefinitions(data)
    } catch (error) {
      console.error('Failed to load workflow definitions:', error)
      toast.error('Failed to load workflows')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNew = () => {
    setSelectedDefinition(undefined)
    setIsDesigning(true)
  }

  const handleEdit = (def: WorkflowDefinition) => {
    setSelectedDefinition(def)
    setIsDesigning(true)
  }

  const handleSaveWorkflow = async (workflow: WorkflowDefinition) => {
    try {
      if (!companyId || !user?.id) return

      const effectiveGroupId = groupId ?? undefined
      if (workflow.id) {
        // Update existing draft
        await WorkflowLifecycleService.saveDraft(companyId, workflow.id, workflow, user.id, effectiveGroupId)
        toast.success('Workflow updated successfully')
      } else {
        // Create new draft
        const newId = await WorkflowLifecycleService.createDraft(companyId, {
          name: workflow.name,
          description: workflow.description,
          category: workflow.category,
          bpmnXml: workflow.bpmnXml,
          steps: workflow.steps,
          triggerType: workflow.triggerType
        }, user.id, effectiveGroupId)
        toast.success('New workflow created')
        return newId
      }
      setIsDesigning(false)
      loadDefinitions()
    } catch (error) {
      console.error('Error saving workflow:', error)
      toast.error('Failed to save')
    }
  }

  const filteredDefinitions = definitions.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.category?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (isDesigning) {
    return (
      <DashboardLayout>
        <div className="w-full animate-in slide-in-from-right-4 duration-300">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setIsDesigning(false)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-2xl font-bold tracking-tight">
                {selectedDefinition ? `Edit: ${selectedDefinition.name}` : 'Create New Workflow'}
              </h1>
            </div>
          </div>
          <WorkflowModeler initialWorkflow={selectedDefinition} onSave={handleSaveWorkflow} />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              <Network className="w-10 h-10 text-primary" />
              Process Library
            </h1>
            <p className="text-muted-foreground text-lg">
              Design and deploy BPMN 2.0 compliant automated processes and approval flows.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="shadow-sm" onClick={loadDefinitions}>
              <Zap className="w-4 h-4 mr-2 text-yellow-500" />
              Check Deployment Status
            </Button>
            <Button className="shadow-md bg-primary hover:bg-primary/90 transition-all font-semibold" onClick={handleCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-card p-4 rounded-2xl border-2 mb-8 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filter by template name, category or owner..."
              className="pl-9 h-11 bg-background border-none focus-visible:ring-primary/20 transition-all rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-600">
              {definitions.length} Templates Total
            </Badge>
          </div>
        </div>

        {/* Definitions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            [1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse border-2 h-64 overflow-hidden">
                <div className="h-40 bg-accent/20 border-b"></div>
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-accent/20 w-3/4 rounded"></div>
                  <div className="h-3 bg-accent/20 w-1/2 rounded"></div>
                </div>
              </Card>
            ))
          ) : filteredDefinitions.length === 0 ? (
            <div className="col-span-full h-96 flex flex-col items-center justify-center border-2 border-dashed rounded-3xl bg-accent/5">
              <div className="w-20 h-20 bg-accent/50 rounded-full flex items-center justify-center mb-4">
                <FileCode className="w-10 h-10 opacity-20" />
              </div>
              <h3 className="text-xl font-bold">No Workflow Templates Found</h3>
              <p className="text-muted-foreground mb-6">Start by creating your first automated business process definition.</p>
              <Button onClick={handleCreateNew}>
                <Plus className="w-4 h-4 mr-2" />
                Initialize Blueprint
              </Button>
            </div>
          ) : (
            filteredDefinitions.map((def) => (
              <Card key={def.id} className="group overflow-hidden border-2 hover:border-primary/50 transition-all shadow-sm hover:shadow-xl rounded-2xl flex flex-col h-full bg-card">
                <CardHeader className="pb-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4">
                    <Badge variant={def.status === 'active' ? 'default' : 'secondary'} className={cn(
                      "uppercase text-[9px] font-black tracking-widest",
                      def.status === 'active' ? "bg-emerald-500 hover:bg-emerald-600" : ""
                    )}>
                      {def.status}
                    </Badge>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform shadow-inner">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-xl font-extrabold group-hover:text-primary transition-colors line-clamp-1">{def.name}</CardTitle>
                  <CardDescription className="line-clamp-2 h-10 text-sm italic">
                    {def.description || "No description provided for this template."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="py-4 border-y bg-accent/5">
                  <div className="flex items-center justify-between text-xs mb-4">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-yellow-500" />
                      <span className="font-bold">v{def.version}.0</span>
                    </div>
                    <div className="flex items-center gap-2 group-hover:text-primary transition-colors cursor-help">
                      <History className="w-3.5 h-3.5" />
                      <span>{def.usageCount || 0} Runs</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-[10px] font-bold bg-background/50 border-primary/20">
                      {def.category || 'General'}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-bold bg-background/50 border-primary/20 uppercase tracking-tighter">
                      {def.triggerType}
                    </Badge>
                  </div>
                </CardContent>
                <CardFooter className="p-4 mt-auto bg-card grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="w-full font-bold group/btn" onClick={() => handleEdit(def)}>
                    <Settings2 className="w-4 h-4 mr-2 group-hover/btn:rotate-90 transition-transform" />
                    Configure
                  </Button>
                  <Button variant="secondary" size="sm" className="w-full font-bold" asChild>
                    <Link href={`/workflows/instances?definitionId=${def.id}`}>
                      <Eye className="w-4 h-4 mr-2" />
                      Analytics
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
