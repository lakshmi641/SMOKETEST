'use client'

import { useState, useEffect, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { D3TreeOrgChartWrapper } from '@/components/features/org'
import { useCompany } from '@/contexts/CompanyContext'
import { getPositions, getOrgUnits, getCurrentAssignments } from '@/lib/services/org'
import { UserService } from '@/lib/services'
import { Position, OrgUnit, PositionAssignment } from '@/types/org-schema'
import { User } from '@/types'
import { Loader2, FileDown, RefreshCw, Users, User as UserIcon, ChevronDown, ChevronUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { D3TreeNode } from '@/components/features/org/d3TreeDataTransformer'

export default function OrgChartPage() {
  const router = useRouter()
  const { currentCompany, companyId, groupId } = useCompany()
  const [positions, setPositions] = useState<Position[]>([])
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [assignments, setAssignments] = useState<Map<string, PositionAssignment[]>>(new Map())
  const [users, setUsers] = useState<Map<string, User>>(new Map())
  const [loading, setLoading] = useState(true)
  const [simpleMode, setSimpleMode] = useState(false)
  const [chartKey, setChartKey] = useState(0) // Force re-render when needed

  useEffect(() => {
    if (currentCompany) {
      loadOrgData()
    }
  }, [currentCompany])

  async function loadOrgData() {
    if (!companyId) return

    try {
      setLoading(true)

      // Load positions, org units, and users
      const [positionsData, orgUnitsData, usersData] = await Promise.all([
        getPositions(companyId, groupId ?? undefined),
        getOrgUnits(companyId, groupId ?? undefined),
        UserService.getUsers(companyId, groupId ?? undefined)
      ])

      setPositions(positionsData)
      setOrgUnits(orgUnitsData)

      // Create users map for quick lookup
      const usersMap = new Map<string, User>()
      usersData.forEach(user => {
        usersMap.set(user.id, user)
      })
      setUsers(usersMap)

      // Load current assignments for each position (supports multiple assignments)
      const assignmentsMap = new Map<string, PositionAssignment[]>()
      await Promise.all(
        positionsData.map(async (position) => {
          const positionAssignments = await getCurrentAssignments(companyId, position.id)
          assignmentsMap.set(position.id, positionAssignments)
        })
      )
      setAssignments(assignmentsMap)

    } catch (error) {
      console.error('Error loading org chart data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNodeClick = (nodeData: D3TreeNode['attributes']) => {
    // Node click handled by D3TreeOrgChart component (shows employee details card)
    // No navigation needed
  }

  const handleExport = () => {
    // TODO: Implement org chart export functionality
    console.log('Export org chart')
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div>
          <div className="flex items-center justify-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
      <DashboardLayout>
      <div className="space-y-4 flex flex-col h-[calc(100vh-80px)]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              Organization Chart
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Visual representation of {currentCompany?.name || 'your company'} organizational
              structure
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={simpleMode ? 'default' : 'outline'}
              onClick={() => setSimpleMode(!simpleMode)}
              className="flex items-center gap-2"
            >
              {simpleMode ? (
                <>
                  <UserIcon className="w-4 h-4" />
                  <span>Simple Mode</span>
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  <span>Multi-Slot Mode</span>
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                // Trigger expand all via custom event
                window.dispatchEvent(new CustomEvent('d3-tree-expand-all'))
              }}
              title="Expand All Nodes"
            >
              <ChevronDown className="w-4 h-4 mr-2" />
              Expand All
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                // Trigger collapse all via custom event
                window.dispatchEvent(new CustomEvent('d3-tree-collapse-all'))
              }}
              title="Collapse All Nodes"
            >
              <ChevronUp className="w-4 h-4 mr-2" />
              Collapse All
            </Button>
            <Button variant="outline" onClick={loadOrgData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <FileDown className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Org Chart Visualization */}
        {positions.length > 0 ? (
          <div className="flex-1 min-h-0">
            <D3TreeOrgChartWrapper
              positions={positions}
              departments={orgUnits}
              assignments={assignments}
              users={users}
              onNodeClick={handleNodeClick}
              simple={simpleMode}
            />
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No organizational structure found. Please create org units and positions first.
            </p>
            <Button className="mt-4" onClick={() => router.push('/organization')}>
              Go to Organization Management
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
