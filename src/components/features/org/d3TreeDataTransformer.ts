import { Position, OrgUnit, PositionAssignment } from '@/types/org-schema'
import { User } from '@/types/index'

export interface D3TreeNode {
  name: string
  attributes: {
    position: string
    designation: string
    avatar?: string
    level: number
    userId?: string
    isVacant: boolean
    phone?: string
    email?: string
    location?: string
    description?: string
    team?: string
    department?: string
    departmentData?: { parentOrgUnitId: string | null }
    key: string
    positionCode?: string
    recruitmentPriority?: 'high' | 'medium' | 'low'
    // Full data for details
    assignment?: PositionAssignment
    positionData?: Position
    userData?: User
  }
  children?: D3TreeNode[]
  __rd3t?: {
    id: string
    collapsed?: boolean
  }
}

/**
 * Transforms Position, OrgUnit, PositionAssignment, and User data
 * into the hierarchical format expected by react-d3-tree
 */
export function transformToD3TreeData(
  positions: Position[],
  orgUnits: OrgUnit[],
  assignments: Map<string, PositionAssignment[]>,
  users: Map<string, User>,
  simple: boolean = false
): D3TreeNode | null {
  const nodeMap = new Map<string, D3TreeNode>()
  const departmentMap = new Map(orgUnits.map((o) => [o.id, o]))
  const rootNodes: D3TreeNode[] = []

  // Create nodes: One per active assignment
  positions.forEach((position) => {
    const department = position.orgUnitId ? departmentMap.get(position.orgUnitId) : undefined
    const positionAssignments = assignments.get(position.id) || []

    // If no assignments, create one vacant node for the position
    if (positionAssignments.length === 0) {
      const nodeId = `vacant-${position.id}`
      const node: D3TreeNode = {
        name: 'Vacant Position',
        attributes: {
          position: position.title,
          designation: position.title,
          isVacant: true,
          level: position.level,
          recruitmentPriority: position.recruitmentPriority || 'low',
          key: nodeId,
          description: position.description,
          department: department?.name,
          departmentData: department ? { parentOrgUnitId: department.parentOrgUnitId } : undefined,
          positionData: position,
          positionCode: position.code,
        },
        children: [],
        __rd3t: { id: nodeId, collapsed: false },
      }
      nodeMap.set(nodeId, node)
    } else {
      // Create a node for each occupant
      positionAssignments.forEach((assignment, index) => {
        const user = users.get(assignment.userId)
        const nodeId = `${position.id}-${assignment.id}`

        const node: D3TreeNode = {
          name: user?.name || 'Unknown User',
          attributes: {
            position: position.title,
            designation: user?.designation || position.title,
            avatar: user?.avatar,
            level: position.level,
            userId: user?.id,
            isVacant: false,
            key: nodeId,
            phone: user?.contact?.phone,
            email: user?.email,
            description: position.description,
            department: department?.name,
            departmentData: department ? { parentOrgUnitId: department.parentOrgUnitId } : undefined,
            assignment: assignment,
            positionData: position,
            userData: user,
            positionCode: user?.positionCode || position.code,
          },
          children: [],
          __rd3t: { id: nodeId, collapsed: false },
        }
        nodeMap.set(nodeId, node)
      })
    }
  })

  // Second pass: build parent-child relationships
  positions.forEach((position) => {
    const reportsToId = position.reportsToPositionId
    if (!reportsToId) {
      // Find all nodes for this position and add to root
      const nodes = Array.from(nodeMap.values()).filter(n => n.attributes.positionData?.id === position.id)
      nodes.forEach(n => rootNodes.push(n))
      return
    }

    // Find parent position's nodes (could be multiple if multiple occupants)
    // For simplicity, we'll attach to ALL occupants of the parent position OR the parent position itself
    // In a real tree, we might want to attach to specific managers, but for now, 
    // we attach to the FIRST node of the parent position found.
    const parentPosNodes = Array.from(nodeMap.values()).filter(n => n.attributes.positionData?.id === reportsToId)
    const parentNode = parentPosNodes[0]

    const currentPosNodes = Array.from(nodeMap.values()).filter(n => n.attributes.positionData?.id === position.id)

    if (parentNode) {
      currentPosNodes.forEach(childNode => {
        parentNode.children = parentNode.children || []
        parentNode.children.push(childNode)
      })
    } else {
      currentPosNodes.forEach(childNode => rootNodes.push(childNode))
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
      position: 'Root',
      designation: 'Root',
      level: 0,
      isVacant: false,
      key: 'root',
    },
    children: rootNodes,
    __rd3t: {
      id: 'root',
      collapsed: false,
    },
  }
}
