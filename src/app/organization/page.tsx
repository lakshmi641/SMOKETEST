'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  OrgUnitManagement,
  PositionManagement,
  AssignmentManagement,
  DelegationManagement
} from '@/components/features/org'
import { Building2, Briefcase, UserCheck, Shield, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OrgChartDrawer } from '@/components/features/org'
import { useCompany } from '@/contexts/CompanyContext'
import { useOrgUnitsQuery, usePositionsQuery, useActiveAssignmentsQuery } from '@/hooks/queries/useOrgQueries'

export default function OrgStructurePage() {
  const [activeTab, setActiveTab] = useState('orgUnits')
  const [orgChartOpen, setOrgChartOpen] = useState(false)
  const { currentCompany, groupId } = useCompany()
  const companyId = currentCompany?.id

  const { data: orgUnits = [], isLoading: orgUnitsLoading } = useOrgUnitsQuery(companyId, groupId)
  const { data: positions = [], isLoading: positionsLoading } = usePositionsQuery(companyId, groupId)
  const { data: activeAssignments = [], isLoading: assignmentsLoading } = useActiveAssignmentsQuery(
    companyId,
    groupId,
    { enabled: !!companyId }
  )

  const loading = orgUnitsLoading || positionsLoading || assignmentsLoading
  const stats = {
    orgUnits: orgUnits.length,
    positions: positions.length,
    activeAssignments: activeAssignments.length,
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between flex-shrink-0">
          <div>
            <p className="text-muted-foreground mt-1">
              Manage org units, positions, assignments, and delegations
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => setOrgChartOpen(true)}>
            <BarChart3 className="h-4 w-4" />
            View Org Chart
          </Button>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 flex-shrink-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Org Units</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '...' : stats.orgUnits}
              </div>
              <p className="text-xs text-muted-foreground">Organizational units</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Positions</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '...' : stats.positions}
              </div>
              <p className="text-xs text-muted-foreground">Defined positions & roles</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Assignments</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '...' : stats.activeAssignments}
              </div>
              <p className="text-xs text-muted-foreground">Current position occupants</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-2">
          <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
            <TabsTrigger value="orgUnits" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Org Units
            </TabsTrigger>
            <TabsTrigger value="positions" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Positions
            </TabsTrigger>
            <TabsTrigger value="assignments" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Assignments
            </TabsTrigger>
            <TabsTrigger value="delegations" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Delegations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orgUnits" className="space-y-4">
            <OrgUnitManagement />
          </TabsContent>

          <TabsContent value="positions" className="space-y-4">
            <PositionManagement />
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            <AssignmentManagement />
          </TabsContent>

          <TabsContent value="delegations" className="space-y-4">
            <DelegationManagement />
          </TabsContent>
        </Tabs>
      </div>

      {/* Org Chart Drawer */}
      <OrgChartDrawer open={orgChartOpen} onOpenChange={setOrgChartOpen} />
    </DashboardLayout>
  )
}

