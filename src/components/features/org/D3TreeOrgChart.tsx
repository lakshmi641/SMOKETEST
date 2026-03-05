'use client'

import React, { useState, useRef, useCallback, useMemo, useEffect, useRef as useReactRef } from 'react'
import Tree from 'react-d3-tree'
import { Position, OrgUnit, PositionAssignment } from '@/types/org-schema'
import { User } from '@/types/index'
import { transformToD3TreeData, D3TreeNode } from './d3TreeDataTransformer'
import EmployeeDetailsCard from './EmployeeDetailsCard'
import { useCenteredTree } from './useCenteredTree'
import './d3TreeOrgChartStyles.css'

interface D3TreeOrgChartProps {
  positions: Position[]
  departments: OrgUnit[]
  assignments: Map<string, PositionAssignment[]>
  users: Map<string, User>
  onNodeClick?: (nodeData: D3TreeNode['attributes']) => void
  simple?: boolean
}

const D3TreeOrgChart: React.FC<D3TreeOrgChartProps> = ({
  positions,
  departments,
  assignments,
  users,
  onNodeClick,
  simple = false,
}) => {
  const [selectedNode, setSelectedNode] = useState<D3TreeNode['attributes'] | null>(null)
  const [selectedNodeName, setSelectedNodeName] = useState<string>('')
  const [showDetails, setShowDetails] = useState(false)
  const [dimensions, translate, containerRef] = useCenteredTree()
  const treeRef = useRef<any>(null)
  const [treeDataState, setTreeDataState] = useState<D3TreeNode | null>(null)
  const [treeKey, setTreeKey] = useState(0)
  const [initialDepth, setInitialDepth] = useState(10)

  // Transform data to D3 tree format
  const treeData = useMemo(() => {
    return transformToD3TreeData(positions, departments, assignments, users, simple)
  }, [positions, departments, assignments, users, simple])

  // Sync treeDataState with treeData
  useEffect(() => {
    setTreeDataState(treeData)
  }, [treeData])

  // Collect all nodes for EmployeeDetailsCard
  const allNodes = useMemo(() => {
    const nodes: Array<D3TreeNode['attributes'] & { name: string }> = []
    const collectNodes = (node: D3TreeNode) => {
      // Skip virtual root node
      if (node.name !== 'Organization' || node.attributes.key !== 'root') {
        nodes.push({ ...node.attributes, name: node.name })
      }
      if (node.children) {
        node.children.forEach(collectNodes)
      }
    }
    if (treeData) {
      collectNodes(treeData)
    }
    return nodes
  }, [treeData])

  const handleNodeClick = useCallback(
    (nodeDatum: any) => {
      // Skip virtual root node
      if (nodeDatum.name === 'Organization' && nodeDatum.attributes?.key === 'root') {
        return
      }
      const attributes = nodeDatum.attributes as D3TreeNode['attributes']
      setSelectedNode(attributes)
      setSelectedNodeName(nodeDatum.name || '')
      setShowDetails(true)
      onNodeClick?.(attributes)
    },
    [onNodeClick]
  )

  // Custom node rendering
  const renderCustomNodeElement = useCallback(
    (rd3tProps: any) => {
      const { nodeDatum, toggleNode } = rd3tProps
      const attributes = nodeDatum.attributes as D3TreeNode['attributes']
      const hasChildren = nodeDatum.children && nodeDatum.children.length > 0
      const isExpanded = !nodeDatum.__rd3t?.collapsed
      const nodeName = nodeDatum.name || ''

      const getInitials = (name: string) => {
        if (!name || name === 'Vacant Position' || name === 'Organization') return '?'
        return name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      }

      // Skip rendering for virtual root node
      if (nodeDatum.name === 'Organization' && nodeDatum.attributes.key === 'root') {
        return <g></g>
      }

      return (
        <g>
          <foreignObject
            width={300}
            height={120}
            x={-150}
            y={-60}
            className="node-foreign-object"
          >
            <div
              className="relative min-w-[280px] max-w-[280px] p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 rounded-lg"
              style={{
                backgroundColor: attributes.isVacant
                  ? (attributes.recruitmentPriority === 'high' ? '#ef4444'
                    : attributes.recruitmentPriority === 'medium' ? '#3b82f6'
                      : '#9ca3af')
                  : '#22c55e', // Filled positions are always Green
                color: 'white',
              }}
              onClick={(e) => {
                e.stopPropagation()
                handleNodeClick(nodeDatum)
              }}
            >
              {/* Department Badge */}
              {attributes.department && (
                <div
                  className="absolute flex items-center gap-1 bg-yellow-400 text-gray-800 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap z-20 shadow-sm"
                  style={{
                    top: '-8px',
                    right: '-8px',
                    maxWidth: '150px',
                  }}
                >
                  <svg
                    className="w-3 h-3 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  <span className="truncate">{attributes.department}</span>
                </div>
              )}

              {/* Employee Info */}
              <div className="flex items-center gap-3">
                {/* Profile Picture */}
                <div className="flex-shrink-0">
                  {attributes.isVacant ? (
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                  ) : attributes.avatar ? (
                    <img
                      src={attributes.avatar}
                      alt={nodeName}
                      className="w-12 h-12 rounded-full object-cover border-2 border-white"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white text-lg font-semibold border-2 border-white">
                      {getInitials(nodeName)}
                    </div>
                  )}
                </div>

                {/* Name and Position */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base text-white truncate">
                    {nodeName}
                  </h3>
                  <p className="text-sm text-white/90 truncate">{attributes.designation || attributes.position}</p>
                  <p className="text-[10px] text-white/70 truncate uppercase font-bold tracking-wider">{attributes.position}</p>
                </div>
              </div>

              {/* Expand/Collapse Button */}
              {hasChildren && (
                <button
                  className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white rounded-full p-2 border-2 border-blue-500 hover:bg-blue-50 transition-colors shadow-sm z-10"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    toggleNode()
                  }}
                  title={isExpanded ? 'Collapse' : 'Expand'}
                  type="button"
                >
                  <div className="flex items-center gap-1 text-blue-600 font-semibold text-xs">
                    <span>{nodeDatum.children?.length || 0}</span>
                    <svg
                      className="w-3 h-3 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>
              )}
            </div>
          </foreignObject>
        </g>
      )
    },
    [handleNodeClick]
  )

  // Handle expand/collapse all
  useEffect(() => {
    const handleExpandAll = () => {
      if (!treeDataState) return

      // Deep clone the tree to ensure React detects the change
      const expandAllNodes = (node: D3TreeNode): D3TreeNode => {
        const newNode: D3TreeNode = {
          name: node.name,
          attributes: { ...node.attributes },
          __rd3t: {
            id: node.attributes.key,
            collapsed: false,
          },
        }
        if (node.children && node.children.length > 0) {
          newNode.children = node.children.map(expandAllNodes)
        }
        return newNode
      }

      const expanded = expandAllNodes(treeDataState)
      setTreeDataState(expanded)
      setInitialDepth(10) // Show all levels when expanded
      setTreeKey(prev => prev + 1) // Force re-render by changing key
    }

    const handleCollapseAll = () => {
      if (!treeDataState) return

      // Deep clone the tree to ensure React detects the change
      // Collapse all nodes to show only first level (root nodes)
      const collapseAllNodes = (node: D3TreeNode): D3TreeNode => {
        const newNode: D3TreeNode = {
          name: node.name,
          attributes: { ...node.attributes },
        }

        // Skip virtual root node - don't modify it
        if (node.name === 'Organization' && node.attributes.key === 'root') {
          // For virtual root, collapse all its children
          if (node.children && node.children.length > 0) {
            newNode.children = node.children.map(collapseAllNodes)
            newNode.__rd3t = node.__rd3t ? { ...node.__rd3t } : undefined
          }
          return newNode
        }

        // Collapse all nodes that have children
        if (node.children && node.children.length > 0) {
          newNode.__rd3t = {
            id: node.attributes.key,
            collapsed: true, // Explicitly set to collapsed
          }
          // Recursively collapse all children
          newNode.children = node.children.map(collapseAllNodes)
        } else {
          // Keep existing __rd3t for nodes without children
          newNode.__rd3t = node.__rd3t ? { ...node.__rd3t } : undefined
        }

        return newNode
      }

      const collapsed = collapseAllNodes(treeDataState)
      setTreeDataState(collapsed)
      setInitialDepth(1) // Show only first level
      setTreeKey(prev => prev + 1) // Force re-render by changing key
    }

    window.addEventListener('d3-tree-expand-all', handleExpandAll)
    window.addEventListener('d3-tree-collapse-all', handleCollapseAll)

    return () => {
      window.removeEventListener('d3-tree-expand-all', handleExpandAll)
      window.removeEventListener('d3-tree-collapse-all', handleCollapseAll)
    }
  }, [treeDataState])

  if (!treeData || !treeDataState) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No organizational structure found.</p>
      </div>
    )
  }

  return (
    <>
      <div
        ref={containerRef}
        className="w-full h-full min-h-[600px] bg-gray-50 dark:bg-gray-900 overflow-auto"
        style={{ position: 'relative', width: '100%', height: '100%' }}
      >
        {dimensions.width > 0 && dimensions.height > 0 && treeDataState ? (
          <Tree
            key={treeKey}
            ref={treeRef}
            data={treeDataState as any}
            orientation="vertical"
            pathFunc="step"
            nodeSize={{ x: 300, y: 150 }}
            translate={translate}
            dimensions={dimensions}
            renderCustomNodeElement={renderCustomNodeElement}
            collapsible={true}
            initialDepth={initialDepth}
            zoom={0.8}
            scaleExtent={{ min: 0.1, max: 2 }}
            separation={{ siblings: 1.2, nonSiblings: 1.5 }}
            onNodeClick={handleNodeClick}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Loading chart...</p>
          </div>
        )}
      </div>

      {showDetails && selectedNode && (() => {
        // Find parent org unit name
        const parentOrgUnit = selectedNode.departmentData?.parentOrgUnitId
          ? departments.find(d => d.id === selectedNode.departmentData?.parentOrgUnitId)
          : null

        // Find reports to position and assigned user
        let reportsToName: string | null = null
        let reportsToPositionTitle: string | null = null
        if (selectedNode.positionData?.reportsToPositionId) {
          const reportsToPosition = positions.find(p => p.id === selectedNode.positionData?.reportsToPositionId)
          if (reportsToPosition) {
            // Find assigned user for this position
            const reportsToAssignments = assignments.get(reportsToPosition.id) || []
            const reportsToAssignment = reportsToAssignments[0] // Get first assignment
            const reportsToUser = reportsToAssignment ? users.get(reportsToAssignment.userId) : null

            if (reportsToUser) {
              reportsToName = reportsToUser.name
              reportsToPositionTitle = reportsToPosition.title
            } else {
              reportsToPositionTitle = reportsToPosition.title
            }
          }
        }

        return (
          <EmployeeDetailsCard
            employees={allNodes.map((n) => ({
              id: n.key,
              name: n.name,
              position: n.position,
              positionName: n.position,
              department: n.department,
              avatar: n.avatar,
              imageUrl: n.avatar,
              level: n.level,
              userId: n.userId,
              isVacant: n.isVacant,
              phone: n.phone,
              email: n.email,
              location: n.location,
              description: n.description,
              team: n.team,
              assignment: n.assignment,
              positionData: n.positionData,
              departmentData: n.departmentData,
              userData: n.userData,
              positionCode: n.positionCode,
            }))}
            employee={{
              id: selectedNode.key,
              name: selectedNodeName || allNodes.find((n) => n.key === selectedNode.key)?.name || selectedNode.position,
              position: selectedNode.position,
              positionName: selectedNode.position,
              department: selectedNode.department,
              avatar: selectedNode.avatar,
              imageUrl: selectedNode.avatar,
              level: selectedNode.level,
              userId: selectedNode.userId,
              isVacant: selectedNode.isVacant,
              phone: selectedNode.phone,
              email: selectedNode.email,
              location: selectedNode.location,
              description: selectedNode.description,
              team: selectedNode.team,
              assignment: selectedNode.assignment,
              positionData: selectedNode.positionData,
              departmentData: selectedNode.departmentData,
              userData: selectedNode.userData,
              positionCode: selectedNode.positionCode,
              parentOrgUnit: parentOrgUnit?.name || parentOrgUnit?.code || null,
              reportsTo: reportsToPositionTitle,
              reportsToName: reportsToName,
            }}
            handleClose={() => {
              setShowDetails(false)
              setSelectedNode(null)
              setSelectedNodeName('')
            }}
          />
        )
      })()}
    </>
  )
}

export default D3TreeOrgChart
