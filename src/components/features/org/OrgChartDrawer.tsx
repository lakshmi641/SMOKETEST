'use client'

import { useState, useEffect } from 'react'
import { X, RefreshCw, FileDown, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCompany } from '@/contexts/CompanyContext'
import { getPositions, getOrgUnits, getCurrentAssignments } from '@/lib/services/org'
import { UserService } from '@/lib/services'
import { Position, OrgUnit, PositionAssignment } from '@/types/org-schema'
import { User } from '@/types'
import { D3TreeOrgChartWrapper, D3TreeNode } from '@/components/features/org'
import { useRouter } from 'next/navigation'

interface OrgChartDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrgChartDrawer({ open, onOpenChange }: OrgChartDrawerProps) {
  const { currentCompany, companyId, groupId } = useCompany()
  const router = useRouter()
  const [positions, setPositions] = useState<Position[]>([])
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [assignments, setAssignments] = useState<Map<string, PositionAssignment[]>>(new Map())
  const [users, setUsers] = useState<Map<string, User>>(new Map())
  const [loading, setLoading] = useState(true)
  const [simpleMode, setSimpleMode] = useState(false)

  useEffect(() => {
    if (open && currentCompany) {
      loadOrgData()
    }
  }, [open, currentCompany])

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
          const positionAssignments = await getCurrentAssignments(companyId, position.id, groupId ?? undefined)
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
    // No navigation needed - details card is shown in the chart component
  }

  const handleExport = () => {
    // TODO: Implement org chart export functionality
    console.log('Export org chart')
  }

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />

      {/* Full Screen Drawer */}
      <div className="fixed inset-0 bg-background shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-card">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Organization Chart</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Visual representation of {currentCompany?.name || 'your company'} organizational structure
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('d3-tree-expand-all'))
              }}
            >
              <ChevronDown className="w-4 h-4 mr-2" />
              Expand All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('d3-tree-collapse-all'))
              }}
            >
              <ChevronUp className="w-4 h-4 mr-2" />
              Collapse All
            </Button>
            <Button variant="outline" onClick={loadOrgData} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <FileDown className="w-4 h-4 mr-2" />
              Export
            </Button>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 p-2"
            >
              <X className="h-6 w-6" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6 bg-background" style={{ minHeight: 0 }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : positions.length > 0 ? (
            <D3TreeOrgChartWrapper
              positions={positions}
              departments={orgUnits}
              assignments={assignments}
              users={users}
              onNodeClick={handleNodeClick}
              simple={false}
            />
          ) : (
            <div className="bg-card rounded-lg shadow p-12 text-center h-full flex items-center justify-center border border-border">
              <div>
                <p className="text-muted-foreground">No organizational structure found. Please create org units and positions first.</p>
                <Button className="mt-4" onClick={() => {
                  onOpenChange(false)
                  router.push('/organization')
                }}>
                  Go to Organization Management
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
