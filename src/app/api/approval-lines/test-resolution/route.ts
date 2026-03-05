/**
 * API endpoint for testing approval line resolution
 * This allows validation of the resolution logic with real org hierarchy data
 */

import { NextRequest, NextResponse } from 'next/server'
import type { ApprovalContext } from '@/types/approval-line-schema'

// Force dynamic to prevent build-time evaluation

export async function POST(request: NextRequest) {
  try {
    // Dynamic imports to prevent Firebase init at build time
    const { previewApprovalLineResolution, getApprovalLine } = await import(
      '@/lib/services/approval-line-service'
    )

    const body = await request.json()
    const { companyId, approvalLineId, context, groupId } = body

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      )
    }

    if (!approvalLineId) {
      return NextResponse.json(
        { error: 'approvalLineId is required' },
        { status: 400 }
      )
    }

    // Validate approval line exists
    const approvalLine = await getApprovalLine(companyId, approvalLineId)
    if (!approvalLine) {
      return NextResponse.json(
        { error: 'Approval line not found' },
        { status: 404 }
      )
    }

    // Build context with defaults
    const approvalContext: ApprovalContext = {
      requesterId: context?.requesterId || 'test-user',
      requesterPositionId: context?.requesterPositionId,
      resourceType: context?.resourceType || 'test',
      resourceId: context?.resourceId || 'test-resource-1',
      amount: context?.amount,
      category: context?.category,
      priority: context?.priority,
      workspaceId: context?.workspaceId,
      metadata: context?.metadata || {},
    }

    // Resolve the approval line
    const resolution = await previewApprovalLineResolution(
      companyId,
      approvalLineId,
      approvalContext
    )

    return NextResponse.json({
      success: true,
      approvalLine: {
        id: approvalLine.id,
        name: approvalLine.name,
        status: approvalLine.status,
        resolutionType: approvalLine.resolutionType,
      },
      context: approvalContext,
      resolution,
    })
  } catch (error) {
    console.error('Error testing approval line resolution:', error)
    return NextResponse.json(
      {
        error: 'Failed to resolve approval line',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to fetch available data for testing
 */
export async function GET(request: NextRequest) {
  try {
    // Dynamic imports to prevent Firebase init at build time
    const { getApprovalLines } = await import('@/lib/services/approval-line-service')
    const { getPositions, getOrgUnits } = await import('@/lib/services/org/org-services')

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const groupId = searchParams.get('groupId') || undefined

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      )
    }

    // Fetch available data for testing
    const [approvalLines, positions, departments] = await Promise.all([
      getApprovalLines(companyId, undefined, groupId),
      getPositions(companyId, groupId),
      getOrgUnits(companyId, groupId),
    ])

    // Build position hierarchy map
    const positionHierarchy = positions.map((pos) => ({
      id: pos.id,
      title: pos.title,
      code: pos.code,
      level: pos.level,
      orgUnitId: pos.orgUnitId,
      reportsToPositionId: pos.reportsToPositionId,
      approvalAuthority: pos.approvalAuthority,
    }))

    return NextResponse.json({
      success: true,
      data: {
        approvalLines: approvalLines.map((al) => ({
          id: al.id,
          name: al.name,
          status: al.status,
          resolutionType: al.resolutionType,
          stageCount: al.stages?.length || 0,
        })),
        positions: positionHierarchy,
        departments: departments.map((d) => ({
          id: d.id,
          name: d.name,
          code: d.code,
        })),
        hierarchyTree: buildHierarchyTree(positionHierarchy),
      },
    })
  } catch (error) {
    console.error('Error fetching test data:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch test data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * Build a tree structure from positions for visualization
 */
function buildHierarchyTree(
  positions: Array<{
    id: string
    title: string
    code: string
    level: number
    reportsToPositionId: string | null
  }>
) {
  // Find root positions (no manager)
  const roots = positions.filter((p) => !p.reportsToPositionId)

  function buildBranch(
    position: (typeof positions)[0]
  ): {
    id: string
    title: string
    code: string
    level: number
    children: ReturnType<typeof buildBranch>[]
  } {
    const children = positions.filter(
      (p) => p.reportsToPositionId === position.id
    )
    return {
      id: position.id,
      title: position.title,
      code: position.code,
      level: position.level,
      children: children.map(buildBranch),
    }
  }

  return roots.map(buildBranch)
}
