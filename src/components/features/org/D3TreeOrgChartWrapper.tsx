'use client'

import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import D3TreeOrgChart from './D3TreeOrgChart'
import { Position, OrgUnit, PositionAssignment } from '@/types/org-schema'
import { User } from '@/types/index'

interface D3TreeOrgChartWrapperProps {
  positions: Position[]
  departments: OrgUnit[]
  assignments: Map<string, PositionAssignment[]>
  users: Map<string, User>
  onNodeClick?: (nodeData: any) => void
  simple?: boolean
}

/**
 * Wrapper component that provides a card container for the D3 Tree org chart
 */
export function D3TreeOrgChartWrapper({
  positions,
  departments,
  assignments,
  users,
  onNodeClick,
  simple = false,
}: D3TreeOrgChartWrapperProps) {
  if (positions.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">
          No organizational structure found. Please create org units and positions first.
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-0 overflow-hidden h-full flex flex-col">
      <div className="flex-1 min-h-0 w-full h-full">
        <D3TreeOrgChart
          positions={positions}
          departments={departments}
          assignments={assignments}
          users={users}
          onNodeClick={onNodeClick}
          simple={simple}
        />
      </div>
    </Card>
  )
}
