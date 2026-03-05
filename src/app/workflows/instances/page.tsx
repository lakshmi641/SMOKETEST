'use client'

import { useState, useEffect, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { collection, query, onSnapshot, orderBy, limit, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Network,
  Search,
  ExternalLink,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Clock,
  Circle,
  History,
  Activity as ActivityIcon,
  Plus,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  ShieldCheck
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { cn } from '@/lib/utils'

interface ApprovalInstance {
  id: string
  approvalLineName: string
  resourceTitle: string
  resourceId: string
  resourceNumber?: string | number
  resourceType?: string
  status: 'in_progress' | 'approved' | 'rejected' | 'cancelled'
  currentStageOrder: number
  stageInstances: any[]
  startedAt: string
  dueAt?: string
  completedAt?: string
  createdBy: string
}

export default function WorkflowHubInstancesPage() {
  const { companyId } = useCompany()
  const [instances, setInstances] = useState<ApprovalInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [stats, setStats] = useState({
    active: 0,
    approved: 0,
    rejected: 0,
    slaBreaches: 0,
    definitionsCount: 0,
    completionRate: 0
  })

  useEffect(() => {
    if (!companyId) return

    // 1. Fetch Instances
    const qInstances = query(
      collection(db, `companies/${companyId}/approvalInstances`),
      orderBy('createdAt', 'desc'),
      limit(200)
    )

    const unsubscribeInstances = onSnapshot(qInstances, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ApprovalInstance[]
      setInstances(data)

      const now = new Date()
      const active = data.filter(i => i.status === 'in_progress').length
      const approved = data.filter(i => i.status === 'approved').length
      const rejected = data.filter(i => i.status === 'rejected').length

      // Calculate SLA breaches dynamically
      const slaBreaches = data.filter(i => {
        if (!i.dueAt) return false
        const due = new Date(i.dueAt)
        if (i.status === 'in_progress') {
          return due < now
        }
        if (i.completedAt) {
          const completed = new Date(i.completedAt)
          return completed > due
        }
        return false
      }).length

      const totalFinished = approved + rejected
      const completionRate = totalFinished > 0 ? Math.round((approved / totalFinished) * 100) : 0

      setStats(prev => ({
        ...prev,
        active,
        approved,
        rejected,
        slaBreaches,
        completionRate
      }))

      setLoading(false)
    }, (error) => {
      console.error("Error fetching instances:", error)
      setLoading(false)
    })

    // 2. Fetch Definitions Count
    const qDefinitions = query(
      collection(db, `companies/${companyId}/approvalLines`),
      where('status', '==', 'active')
    )

    const unsubscribeDefinitions = onSnapshot(qDefinitions, (snapshot) => {
      setStats(prev => ({
        ...prev,
        definitionsCount: snapshot.docs.length
      }))
    })

    // 3. Fetch Users
    const qUsers = query(collection(db, `companies/${companyId}/users`))
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    })

    return () => {
      unsubscribeInstances()
      unsubscribeDefinitions()
      unsubscribeUsers()
    }
  }, [companyId])

  const filteredInstances = useMemo(() => {
    return instances.filter(i =>
      (i.resourceTitle?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (i.approvalLineName?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    )
  }, [instances, searchQuery])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>
      case 'rejected':
        return <Badge variant="destructive" className="bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/20 transition-colors"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>
      case 'in_progress':
        return <Badge variant="outline" className="text-blue-600 border-blue-500/20 bg-blue-500/10 animate-pulse-subtle"><Clock className="w-3 h-3 mr-1" /> Running</Badge>
      case 'cancelled':
        return <Badge variant="secondary" className="opacity-60"><Circle className="w-3 h-3 mr-1" /> Cancelled</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto max-w-7xl animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              <History className="w-10 h-10 text-primary" />
              Process Tracking
            </h1>
            <p className="text-muted-foreground text-lg">
              Manage, audit, and orchestrate all enterprise workflow executions in real-time.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="shadow-sm">
              <Search className="w-4 h-4 mr-2" />
              Advanced Audit
            </Button>
            <Button className="shadow-md bg-primary hover:bg-primary/90 transition-all font-semibold" asChild>
              <Link href="/workflows">
                <Plus className="w-4 h-4 mr-2" />
                New Workflow
              </Link>
            </Button>
          </div>
        </div>

        {/* Intelligence Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <Card className="border-none shadow-sm bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-blue-600/80 uppercase tracking-wider">Active Instances</p>
                  <p className="text-3xl font-bold">{stats.active}</p>
                </div>
                <ActivityIcon className="w-6 h-6 text-blue-500" />
              </div>
              <div className="mt-4 flex items-center text-xs text-blue-600 font-medium">
                <TrendingUp className="w-3 h-3 mr-1" />
                Real-time monitoring
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-emerald-50/50 dark:bg-emerald-900/10 border-l-4 border-l-emerald-500">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-emerald-600/80 uppercase tracking-wider">Completion Rate</p>
                  <p className="text-3xl font-bold">{stats.completionRate}%</p>
                </div>
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <div className="mt-4 flex items-center text-xs text-emerald-600 font-medium">
                Total {stats.approved} approved workflows
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-rose-50/50 dark:bg-rose-900/10 border-l-4 border-l-rose-500">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-rose-600/80 uppercase tracking-wider">SLA Breaches</p>
                  <p className={cn("text-3xl font-bold", stats.slaBreaches > 0 ? "text-rose-600" : "text-emerald-600")}>
                    {stats.slaBreaches}
                  </p>
                </div>
                <AlertCircle className={cn("w-6 h-6", stats.slaBreaches > 0 ? "text-rose-500" : "text-emerald-500")} />
              </div>
              <div className="mt-4 flex items-center text-xs text-rose-600 font-medium">
                {stats.slaBreaches > 0 ? 'Requires immediate action' : 'All delivery targets met'}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-accent/50 border-l-4 border-l-primary">
            <CardContent className="p-6 flex flex-col justify-between h-full">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Definitions</p>
                <p className="text-lg font-bold">{stats.definitionsCount} Active Templates</p>
              </div>
              <Button variant="link" className="p-0 h-auto justify-start text-primary font-bold mt-2 group" asChild>
                <Link href="/workflows">
                  Manage Definitions <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Instances Table */}
        <Card className="border-2 shadow-xl overflow-hidden rounded-2xl bg-card">
          <div className="p-6 border-b bg-accent/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-bold text-lg">Execution Registry</h3>
              <Badge variant="secondary" className="font-mono">{filteredInstances.length}</Badge>
            </div>
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by resource title, ID, or workflow policy..."
                className="pl-9 h-11 bg-background border-2 focus-visible:ring-primary/20 transition-all rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-accent/10">
                <TableRow className="hover:bg-transparent border-b-2">
                  <TableHead className="w-[35%] py-4">Resource & Subject</TableHead>
                  <TableHead className="w-[20%]">Workflow Engine</TableHead>
                  <TableHead className="w-[15%]">Status</TableHead>
                  <TableHead className="w-[15%]">Active Stage</TableHead>
                  <TableHead className="w-[15%] text-right pr-8">Timeline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="h-20">
                        <div className="animate-pulse flex items-center gap-4">
                          <div className="bg-accent h-10 w-10 rounded-lg"></div>
                          <div className="space-y-2 flex-1">
                            <div className="bg-accent h-4 rounded w-1/2"></div>
                            <div className="bg-accent h-2 rounded w-1/4"></div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredInstances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-80 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4 py-12">
                        <div className="w-20 h-20 bg-accent/50 rounded-full flex items-center justify-center mb-2">
                          <History className="w-10 h-10 opacity-20" />
                        </div>
                        <div>
                          <p className="text-xl font-bold">No instances detected</p>
                          <p className="text-muted-foreground">Workflows will appear here once they are triggered by tasks or projects.</p>
                        </div>
                        <Button variant="outline" className="mt-4" onClick={() => setSearchQuery('')}>Clear Search</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInstances.map((instance) => {
                    const creator = users.find(u => u.id === instance.createdBy)
                    const creatorName = creator?.name || 'System'

                    return (
                      <TableRow
                        key={instance.id}
                        className="group cursor-pointer hover:bg-primary/5 transition-all border-b last:border-0"
                        onClick={() => window.location.href = `/workflows/instances/${instance.id}`}
                      >
                        <TableCell className="py-5 font-medium">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors shadow-sm">
                              <Network className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-base font-bold group-hover:text-primary transition-colors line-clamp-1">{instance.resourceTitle || 'Untitled Resource'}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground font-mono bg-accent/50 px-1.5 py-0.5 rounded leading-none uppercase">
                                  {instance.resourceNumber ? `REF: ${instance.resourceNumber}` : `ID: ${instance.id.substring(0, 8)}`}
                                </span>
                                <Badge variant="outline" className="text-[9px] h-4 py-0 font-normal opacity-70 border-primary/20 bg-primary/5 uppercase">
                                  {instance.resourceType || 'Resource'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 font-semibold text-foreground/80">
                            <ShieldCheck className="w-4 h-4 text-primary" />
                            {instance.approvalLineName || 'Standard Policy'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(instance.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                              <span>{instance.stageInstances?.find(s => s.status === 'active')?.stageName || (instance.status === 'in_progress' ? 'Initializing' : 'Archived')}</span>
                              <span>{instance.currentStageOrder || 0}/{instance.stageInstances?.length || 0}</span>
                            </div>
                            <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full transition-all duration-700 ease-out",
                                  instance.status === 'rejected' ? 'bg-rose-500' :
                                    instance.status === 'approved' ? 'bg-emerald-500' : 'bg-primary'
                                )}
                                style={{
                                  width: instance.stageInstances?.length
                                    ? `${((instance.currentStageOrder || 0) / instance.stageInstances.length) * 100}%`
                                    : instance.status === 'approved' ? '100%' : '0%'
                                }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          <div className="text-sm font-bold text-foreground">
                            {instance.startedAt ? format(new Date(instance.startedAt), 'MMM d, p') : 'N/A'}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                            Triggered by <span className="font-semibold text-primary">{creatorName}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
