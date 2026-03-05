'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  User as UserIcon,
  Users,
  Building2
} from 'lucide-react'
import { Position, OrgUnit, PositionAssignment } from '@/types/org-schema'
import { User } from '@/types/index'
import { cn } from '@/lib/utils'

interface OrgNode {
  position: Position
  department: OrgUnit | undefined
  assignment: PositionAssignment | null // Single assignment for this slot
  slotIndex: number // 1-based index of this slot (1 to headcount)
  isVacant: boolean
  children: OrgNode[]
  isExpanded: boolean
}

interface OrgChartVisualizationProps {
  positions: Position[]
  departments: OrgUnit[]
  assignments: Map<string, PositionAssignment[]>
  users: Map<string, User>
  onNodeClick?: (position: Position) => void
}

export function OrgChartVisualization({
  positions,
  departments,
  assignments,
  users,
  onNodeClick
}: OrgChartVisualizationProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [zoomLevel, setZoomLevel] = useState(100)
  const [expandAll, setExpandAll] = useState(true)
  const [filterByLevel, setFilterByLevel] = useState<number | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  // Memoize assignments and users as arrays for stable references
  const assignmentsArray = useMemo(() => Array.from(assignments.entries()), [assignments])
  const usersArray = useMemo(() => Array.from(users.entries()), [users])

  // Build the org tree - memoized
  const rootNodes = useMemo(() => {
    // Create nodes: One per active assignment + one vacant node if position has zero assignments
    const slotNodes: OrgNode[] = [] // This will hold all individual OrgNode instances
    const slotNodeMap = new Map<string, OrgNode[]>() // positionId -> array of nodes for that position

    positions.forEach(pos => {
      const dept = departments.find(d => d.id === pos.orgUnitId)
      const positionAssignments = assignments.get(pos.id) || []
      const positionNodes: OrgNode[] = []

      if (positionAssignments.length === 0) {
        // One vacant node if no one is assigned
        const vacantNode: OrgNode = {
          position: pos,
          department: dept,
          assignment: null,
          slotIndex: 1, // Still use slotIndex for consistency, even if it's just 1
          isVacant: true,
          children: [],
          isExpanded: expandAll
        }
        positionNodes.push(vacantNode)
        slotNodes.push(vacantNode)
      } else {
        // One node per actual occupant
        positionAssignments.forEach((assignment, idx) => {
          const slotNode: OrgNode = {
            position: pos,
            department: dept,
            assignment,
            slotIndex: idx + 1, // Use index + 1 as slot number
            isVacant: false,
            children: [],
            isExpanded: expandAll
          }
          positionNodes.push(slotNode)
          slotNodes.push(slotNode)
        })
      }

      slotNodeMap.set(pos.id, positionNodes)
    })

    // Build parent-child relationships
    const roots: OrgNode[] = []

    positions.forEach(pos => {
      const currentNodes = slotNodeMap.get(pos.id) || []

      if (pos.reportsToPositionId) {
        const parentNodes = slotNodeMap.get(pos.reportsToPositionId)
        if (parentNodes && parentNodes.length > 0) {
          // Connect all current nodes to the FIRST parent node found (for stability in tree drawing)
          const parentNode = parentNodes[0]
          if (parentNode) {
            currentNodes.forEach(childNode => {
              parentNode.children.push(childNode)
            })
          }
        } else {
          // Parent position not found or has no nodes, treat current nodes as roots
          roots.push(...currentNodes)
        }
      } else {
        // No parent, these are root nodes
        roots.push(...currentNodes)
      }
    })

    // Sort children
    const sortChildren = (node: OrgNode) => {
      node.children.sort((a, b) => a.position.level - b.position.level)
      node.children.forEach(sortChildren)
    }
    roots.forEach(sortChildren)

    // Sort the root nodes themselves by level
    roots.sort((a, b) => a.position.level - b.position.level)

    return roots
  }, [positions, departments, assignmentsArray, expandAll, expandedNodes])

  // Check if node matches search criteria - memoized
  const nodeMatchesSearch = useCallback((node: OrgNode): boolean => {
    if (!searchTerm) return true

    const searchLower = searchTerm.toLowerCase()
    const matchesPosition = node.position.title.toLowerCase().includes(searchLower) ||
      node.position.code.toLowerCase().includes(searchLower)
    const matchesDept = node.department?.name.toLowerCase().includes(searchLower) || false

    // Check if assigned user matches
    const matchesUser = node.assignment ? (() => {
      const assignedUser = users.get(node.assignment!.userId)
      return assignedUser ?
        assignedUser.name.toLowerCase().includes(searchLower) ||
        assignedUser.email.toLowerCase().includes(searchLower) : false
    })() : false

    return matchesPosition || matchesDept || matchesUser
  }, [searchTerm, users])

  // Check if any descendant (including self) matches search - memoized
  const nodeOrDescendantMatchesSearch = useCallback((node: OrgNode): boolean => {
    return nodeMatchesSearch(node) || node.children.some(child => nodeOrDescendantMatchesSearch(child))
  }, [nodeMatchesSearch])

  // Check if node has descendants at the filtered level - memoized
  const hasDescendantAtLevel = useCallback((node: OrgNode, targetLevel: number): boolean => {
    if (node.position.level === targetLevel) return true
    return node.children.some(child => hasDescendantAtLevel(child, targetLevel))
  }, [])

  // Check if node should be shown - memoized
  const shouldShowNode = useCallback((node: OrgNode): boolean => {
    // Level filter: show if this node is at the level OR has descendants at that level
    if (filterByLevel !== null) {
      return hasDescendantAtLevel(node, filterByLevel)
    }

    // Search: show if this node matches OR if it's an ancestor of a matching node
    if (searchTerm) {
      return nodeOrDescendantMatchesSearch(node)
    }

    // No filter: show all
    return true
  }, [filterByLevel, searchTerm, hasDescendantAtLevel, nodeOrDescendantMatchesSearch])

  // Fix state mutation - use functional update
  const toggleNode = useCallback((nodeId: string) => {
    if (expandAll) {
      // When expandAll is true, toggle collapsedNodes to override it
      setCollapsedNodes(prev => {
        const next = new Set(prev)
        if (next.has(nodeId)) {
          next.delete(nodeId) // Expand it
        } else {
          next.add(nodeId) // Collapse it
        }
        return next
      })
    } else {
      // When expandAll is false, toggle expandedNodes
      setExpandedNodes(prev => {
        const next = new Set(prev)
        if (next.has(nodeId)) {
          next.delete(nodeId)
        } else {
          next.add(nodeId)
        }
        return next
      })
      // Clear from collapsedNodes if it was there
      setCollapsedNodes(prev => {
        const next = new Set(prev)
        next.delete(nodeId)
        return next
      })
    }
  }, [expandAll])

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 10, 200))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 10, 50))
  }, [])

  const handleResetZoom = useCallback(() => {
    setZoomLevel(100)
  }, [])

  const getLevelColor = useCallback((level: number): string => {
    const colors = [
      'from-purple-500 to-purple-600',  // Level 1 - CEO
      'from-blue-500 to-blue-600',       // Level 2 - C-Suite
      'from-indigo-500 to-indigo-600',   // Level 3 - VPs
      'from-cyan-500 to-cyan-600',       // Level 4 - GMs
      'from-teal-500 to-teal-600',       // Level 5 - Managers
      'from-green-500 to-green-600',     // Level 6 - Senior
      'from-lime-500 to-lime-600',       // Level 7 - Executives
      'from-amber-500 to-amber-600',     // Level 8 - Trainees
      'from-orange-500 to-orange-600',   // Level 9 - Interns
    ]
    return colors[level - 1] || 'from-gray-500 to-gray-600'
  }, [])

  const OrgNodeCard = ({ node, depth = 0 }: { node: OrgNode; depth?: number }) => {
    if (!shouldShowNode(node)) return null

    const hasChildren = node.children.length > 0
    const visibleChildren = node.children.filter(shouldShowNode)

    // Get node ID for expand/collapse tracking
    const nodeId = `${node.position.id}-${node.slotIndex}`

    // Auto-expand when searching to show matching nodes
    const shouldAutoExpand = searchTerm && hasChildren && nodeOrDescendantMatchesSearch(node) && !nodeMatchesSearch(node)
    // Check if explicitly collapsed (overrides expandAll), then check expandAll or expandedNodes, or auto-expand
    const isExpanded = shouldAutoExpand || (!collapsedNodes.has(nodeId) && (expandAll || expandedNodes.has(nodeId)))

    return (
      <div className="flex flex-col items-center">
        {/* Node Card */}
        <Card
          className={cn(
            'relative min-w-[200px] max-w-[220px] p-3 cursor-pointer transition-all duration-200',
            'hover:shadow-lg hover:scale-105 border-2',
            !node.isVacant
              ? 'border-green-500 dark:border-green-600 bg-green-50/10'
              : (node.position.recruitmentPriority === 'high' ? 'border-red-500 dark:border-red-600 bg-red-50/10'
                : node.position.recruitmentPriority === 'medium' ? 'border-blue-500 dark:border-blue-600 bg-blue-50/10'
                  : 'border-border bg-muted/20')
          )}
          onClick={() => onNodeClick?.(node.position)}
        >
          {/* Level Badge */}
          <div className="absolute -top-2 -right-2">
            <Badge variant="secondary" className={cn('bg-gradient-to-r text-white font-semibold', getLevelColor(node.position.level))}>
              L{node.position.level}
            </Badge>
          </div>

          {/* Org Unit Badge */}
          {node.department && (
            <div className="flex items-center gap-1 mb-2">
              <Building2 className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">{node.department.code}</span>
            </div>
          )}

          {/* Position Title with Slot Number */}
          <p className="text-xs font-semibold text-foreground bg-muted px-2 py-1 rounded mb-2 text-center">
            {node.assignment ? (users.get(node.assignment.userId)?.designation || node.position.title) : node.position.title}
            {node.assignment && (
              <span className="text-xs text-muted-foreground ml-1">#{node.slotIndex}</span>
            )}
          </p>

          {/* Assigned User or Vacant */}
          {node.isVacant ? (
            <div className="flex items-center gap-2 p-2 bg-muted/50 border border-dashed border-muted-foreground/30 rounded">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <UserIcon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground italic font-medium">Vacant</p>
              </div>
            </div>
          ) : node.assignment ? (() => {
            const assignedUser = users.get(node.assignment!.userId)

            if (!assignedUser) {
              return (
                <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/30 rounded">
                  <UserIcon className="w-5 h-5 text-orange-500 dark:text-orange-400" />
                  <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">User Not Found</p>
                </div>
              )
            }

            return (
              <div className="flex items-center gap-2 p-2 bg-card border border-border rounded">
                {/* User Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                  {assignedUser.avatar ? (
                    <img
                      src={assignedUser.avatar}
                      alt={assignedUser.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    assignedUser.name.charAt(0).toUpperCase()
                  )}
                </div>

                {/* User Name and Type */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-foreground truncate">
                    {assignedUser.name}
                  </h3>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs mt-0.5',
                      node.assignment!.assignmentType === 'permanent' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' :
                        node.assignment!.assignmentType === 'temporary' ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' :
                          'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                    )}
                  >
                    {node.assignment!.assignmentType}
                  </Badge>
                </div>
              </div>
            )
          })() : null}

          {/* Expand/Collapse Button */}
          {hasChildren && (
            <button
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-card rounded-full p-1 border-2 border-border hover:border-primary transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                toggleNode(`${node.position.id}-${node.slotIndex}`)
              }}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-foreground" />
              )}
            </button>
          )}
        </Card>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="relative mt-8">
            {/* Vertical line from parent card to children level */}
            <div className="absolute left-1/2 -translate-x-1/2 w-0.5 h-8 bg-border -top-8 z-0" />

            {/* Horizontal line connecting all children (only if more than one) */}
            {visibleChildren.length > 1 && (
              <div
                className="absolute h-0.5 bg-border top-0 z-0"
                style={{
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: `${(visibleChildren.length - 1) * 236}px`,
                }}
              />
            )}

            {/* Children nodes */}
            <div className="flex gap-4 pt-8 flex-wrap justify-center relative z-10">
              {visibleChildren.map((child, idx) => (
                <div key={`${child.position.id}-${child.slotIndex}`} className="relative">
                  {/* Vertical connector from horizontal line (or parent) to child */}
                  <div className="absolute left-1/2 -translate-x-1/2 w-0.5 h-8 bg-border -top-8 z-0" />
                  <OrgNodeCard node={child} depth={depth + 1} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const uniqueLevels = useMemo(() =>
    Array.from(new Set(positions.map(p => p.level))).sort((a, b) => a - b),
    [positions]
  )

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by position, org unit, or person..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Level Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={filterByLevel || ''}
              onChange={(e) => setFilterByLevel(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-2 border border-input rounded-md text-sm bg-background text-foreground"
            >
              <option value="">All Levels</option>
              {uniqueLevels.map(level => (
                <option key={level} value={level}>Level {level}</option>
              ))}
            </select>
          </div>

          {/* Expand/Collapse All */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandAll(!expandAll)}
          >
            <Users className="w-4 h-4 mr-2" />
            {expandAll ? 'Collapse All' : 'Expand All'}
          </Button>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 border border-border rounded-md">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 50}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="px-2 text-sm font-medium">{zoomLevel}%</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 200}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetZoom}
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              <strong>{departments.length}</strong> Org Units
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              <strong>{positions.length}</strong> Positions
            </span>
          </div>
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-foreground">
              <strong>{Array.from(assignments.values()).reduce((sum, arr) => sum + arr.length, 0)}</strong> Assigned
            </span>
          </div>
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              <strong>Unlimited</strong> Capacity
            </span>
          </div>
        </div>
      </Card>

      {/* Org Chart */}
      <Card className="p-8 overflow-auto" ref={containerRef}>
        <div
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.2s ease-in-out',
          }}
        >
          <div className="flex gap-4 justify-center flex-wrap">
            {rootNodes.filter(shouldShowNode).map(node => (
              <OrgNodeCard key={`${node.position.id}-${node.slotIndex}`} node={node} />
            ))}
          </div>
        </div>

        {rootNodes.filter(shouldShowNode).length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
            <p>No positions found matching your criteria</p>
          </div>
        )}
      </Card>

      {/* Legend */}
      <Card className="p-4">
        <h4 className="text-sm font-semibold mb-3 text-foreground">Organization Levels</h4>
        <div className="flex flex-wrap gap-2">
          {uniqueLevels.map(level => (
            <Badge
              key={level}
              className={cn('bg-gradient-to-r text-white', getLevelColor(level))}
            >
              Level {level}
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  )
}

