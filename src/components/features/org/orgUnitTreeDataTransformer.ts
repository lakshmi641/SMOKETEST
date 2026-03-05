import { OrgUnit } from '@/types/org-schema'

export interface OrgUnitTreeNode {
  name: string
  attributes: {
    code: string
    description?: string
    location?: string
    status: string
    key: string
    orgUnitData?: OrgUnit
  }
  children?: OrgUnitTreeNode[]
  __rd3t?: {
    id: string
    collapsed?: boolean
  }
}

/**
 * Transforms OrgUnit data into hierarchical format for react-d3-tree
 */
export function transformOrgUnitsToTreeData(orgUnits: OrgUnit[]): OrgUnitTreeNode | null {
  const nodeMap = new Map<string, OrgUnitTreeNode>()
  const rootNodes: OrgUnitTreeNode[] = []

  // First pass: create all nodes
  orgUnits.forEach((orgUnit) => {
    const node: OrgUnitTreeNode = {
      name: orgUnit.name,
      attributes: {
        code: orgUnit.code,
        description: orgUnit.description,
        location: orgUnit.location,
        status: orgUnit.status,
        key: orgUnit.id,
        orgUnitData: orgUnit,
      },
      children: [],
      __rd3t: {
        id: orgUnit.id,
        collapsed: false,
      },
    }
    nodeMap.set(orgUnit.id, node)
  })

  // Second pass: build parent-child relationships
  orgUnits.forEach((orgUnit) => {
    const node = nodeMap.get(orgUnit.id)
    if (!node) return

    if (orgUnit.parentOrgUnitId) {
      const parentNode = nodeMap.get(orgUnit.parentOrgUnitId)
      if (parentNode) {
        parentNode.children = parentNode.children || []
        parentNode.children.push(node)
      } else {
        rootNodes.push(node)
      }
    } else {
      rootNodes.push(node)
    }
  })

  // If we have multiple roots, create a virtual root
  if (rootNodes.length === 0) {
    return null
  }

  if (rootNodes.length === 1) {
    return rootNodes[0] || null
  }

  // Multiple roots - create a virtual root node
  return {
    name: 'Organization',
    attributes: {
      code: 'ROOT',
      status: 'active',
      key: 'root',
    },
    children: rootNodes,
    __rd3t: {
      id: 'root',
      collapsed: false,
    },
  }
}
