'use client'

import React, { useState, useMemo } from 'react'
import { OrgUnit } from '@/types/org-schema'
import { ChevronRight, ChevronDown, Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface OrgUnitTreeViewProps {
  orgUnits: OrgUnit[]
}

interface TreeNode {
  orgUnit: OrgUnit
  children: TreeNode[]
}

export function OrgUnitTreeView({ orgUnits }: OrgUnitTreeViewProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  // Build tree structure based on parent-child relationships
  const tree = useMemo(() => {
    const nodeMap = new Map<string, TreeNode>()
    const rootNodes: TreeNode[] = []

    // Create all nodes
    orgUnits.forEach((orgUnit) => {
      nodeMap.set(orgUnit.id, {
        orgUnit,
        children: [],
      })
    })

    // Build parent-child relationships
    orgUnits.forEach((orgUnit) => {
      const node = nodeMap.get(orgUnit.id)
      if (!node) return

      if (orgUnit.parentOrgUnitId) {
        const parentNode = nodeMap.get(orgUnit.parentOrgUnitId)
        if (parentNode) {
          parentNode.children.push(node)
        } else {
          // Parent not found, treat as root
          rootNodes.push(node)
        }
      } else {
        // No parent, this is a root node
        rootNodes.push(node)
      }
    })

    // Sort children by name
    const sortChildren = (node: TreeNode) => {
      node.children.sort((a, b) => a.orgUnit.name.localeCompare(b.orgUnit.name))
      node.children.forEach(sortChildren)
    }
    rootNodes.forEach(sortChildren)

    return rootNodes
  }, [orgUnits])

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  const expandAll = () => {
    const allIds = new Set<string>()
    const collectIds = (nodes: TreeNode[]) => {
      nodes.forEach((node) => {
        if (node.children.length > 0) {
          allIds.add(node.orgUnit.id)
          collectIds(node.children)
        }
      })
    }
    collectIds(tree)
    setExpandedNodes(allIds)
  }

  const collapseAll = () => {
    setExpandedNodes(new Set())
  }

  const renderNode = (node: TreeNode, level: number = 0) => {
    const hasChildren = node.children.length > 0
    const isExpanded = expandedNodes.has(node.orgUnit.id)
    const indent = level * 24

    return (
      <div key={node.orgUnit.id} className="select-none">
        <div
          className={cn(
            'flex items-center gap-2 py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md cursor-pointer transition-colors',
            level === 0 && 'font-medium'
          )}
          style={{ paddingLeft: `${12 + indent}px` }}
          onClick={() => hasChildren && toggleNode(node.orgUnit.id)}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
            )
          ) : (
            <div className="w-4 h-4 flex-shrink-0" />
          )}
          <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="flex-1 text-sm">{node.orgUnit.name}</span>
          <Badge variant="outline" className="text-xs">
            {node.orgUnit.code}
          </Badge>
          <Badge
            variant={
              node.orgUnit.status === 'active'
                ? 'default'
                : node.orgUnit.status === 'inactive'
                  ? 'secondary'
                  : 'outline'
            }
            className="text-xs"
          >
            {node.orgUnit.status}
          </Badge>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  if (tree.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No organizational units found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 h-full flex flex-col min-h-0">
      <div className="flex justify-end gap-2 flex-shrink-0">
        <button
          onClick={expandAll}
          className="text-sm text-blue-600 hover:text-blue-700 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
        >
          Expand All
        </button>
        <button
          onClick={collapseAll}
          className="text-sm text-blue-600 hover:text-blue-700 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
        >
          Collapse All
        </button>
      </div>
      <div 
        className="border rounded-lg bg-white dark:bg-gray-900 overflow-y-scroll overflow-x-hidden" 
        style={{ 
          height: 'calc(100vh - 500px)',
          maxHeight: 'calc(100vh - 500px)',
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 #f1f5f9'
        }}
      >
        <div className="p-4 pb-32">
          {tree.map((node) => renderNode(node))}
        </div>
      </div>
    </div>
  )
}
