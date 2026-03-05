import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getOrgUnits,
  getOrgUnit,
  createOrgUnit,
  updateOrgUnit,
  deleteOrgUnit,
  getPositions,
  getPosition,
  getPositionsByOrgUnit,
  createPosition,
  updatePosition,
  deletePosition,
  deletePositions,
  getCurrentAssignments,
  getAllActiveAssignments,
  getPositionAssignmentHistory,
  assignUserToPosition,
  endPositionAssignment,
} from '@/lib/services/org'
import type { OrgUnit, Position, PositionAssignment } from '@/types/org-schema'
import toast from 'react-hot-toast'

// Query key factories for consistent invalidation
export const orgQueryKeys = {
  all: ['org'] as const,
  orgUnits: (companyId: string, groupId?: string | null) =>
    ['org', 'org-units', companyId, groupId ?? ''] as const,
  orgUnit: (companyId: string, orgUnitId: string, groupId?: string | null) =>
    ['org', 'org-unit', companyId, orgUnitId, groupId ?? ''] as const,
  positions: (companyId: string, groupId?: string | null) =>
    ['org', 'positions', companyId, groupId ?? ''] as const,
  positionsByOrgUnit: (companyId: string, orgUnitId: string, groupId?: string | null) =>
    ['org', 'positions', companyId, 'orgUnit', orgUnitId, groupId ?? ''] as const,
  position: (companyId: string, positionId: string, groupId?: string | null) =>
    ['org', 'position', companyId, positionId, groupId ?? ''] as const,
  activeAssignments: (companyId: string, groupId?: string | null) =>
    ['org', 'active-assignments', companyId, groupId ?? ''] as const,
  currentAssignments: (companyId: string, positionId: string, groupId?: string | null) =>
    ['org', 'assignments', companyId, positionId, groupId ?? ''] as const,
  assignmentHistory: (companyId: string, positionId: string, groupId?: string | null) =>
    ['org', 'assignment-history', companyId, positionId, groupId ?? ''] as const,
}

export function useOrgUnitsQuery(
  companyId: string | undefined,
  groupId?: string | null,
  initialData?: OrgUnit[]
) {
  return useQuery({
    queryKey: orgQueryKeys.orgUnits(companyId ?? '', groupId),
    queryFn: async () => {
      if (!companyId) return []
      return getOrgUnits(companyId, groupId ?? undefined)
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    initialData,
  })
}

export function useOrgUnitQuery(
  companyId: string | undefined,
  orgUnitId: string | undefined,
  groupId?: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: orgQueryKeys.orgUnit(companyId ?? '', orgUnitId ?? '', groupId),
    queryFn: async () => {
      if (!companyId || !orgUnitId) return null
      return getOrgUnit(companyId, orgUnitId, groupId ?? undefined)
    },
    enabled: !!companyId && !!orgUnitId && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  })
}

export function usePositionsQuery(
  companyId: string | undefined,
  groupId?: string | null,
  initialData?: Position[]
) {
  return useQuery({
    queryKey: orgQueryKeys.positions(companyId ?? '', groupId),
    queryFn: async () => {
      if (!companyId) return []
      return getPositions(companyId, groupId ?? undefined)
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    initialData,
  })
}

export function usePositionQuery(
  companyId: string | undefined,
  positionId: string | undefined,
  groupId?: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: orgQueryKeys.position(companyId ?? '', positionId ?? '', groupId),
    queryFn: async () => {
      if (!companyId || !positionId) return null
      return getPosition(companyId, positionId, groupId ?? undefined)
    },
    enabled: !!companyId && !!positionId && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  })
}

export function usePositionsByOrgUnitQuery(
  companyId: string | undefined,
  orgUnitId: string | undefined,
  groupId?: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: orgQueryKeys.positionsByOrgUnit(companyId ?? '', orgUnitId ?? '', groupId),
    queryFn: async () => {
      if (!companyId || !orgUnitId) return []
      return getPositionsByOrgUnit(companyId, orgUnitId, groupId ?? undefined)
    },
    enabled: !!companyId && !!orgUnitId && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  })
}

export function useActiveAssignmentsQuery(
  companyId: string | undefined,
  groupId?: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: orgQueryKeys.activeAssignments(companyId ?? '', groupId),
    queryFn: async () => {
      if (!companyId) return []
      return getAllActiveAssignments(companyId, groupId ?? undefined)
    },
    enabled: !!companyId && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

export function useCurrentAssignmentsQuery(
  companyId: string | undefined,
  positionId: string | undefined,
  groupId?: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: orgQueryKeys.currentAssignments(companyId ?? '', positionId ?? '', groupId),
    queryFn: async () => {
      if (!companyId || !positionId || !groupId) return []
      return getCurrentAssignments(companyId, positionId, groupId)
    },
    enabled: !!companyId && !!positionId && !!groupId && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000,
  })
}

export function usePositionAssignmentHistoryQuery(
  companyId: string | undefined,
  positionId: string | undefined,
  groupId?: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: orgQueryKeys.assignmentHistory(companyId ?? '', positionId ?? '', groupId),
    queryFn: async () => {
      if (!companyId || !positionId) return []
      return getPositionAssignmentHistory(companyId, positionId, groupId ?? undefined)
    },
    enabled: !!companyId && !!positionId && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000,
  })
}

// Mutations with cache invalidation
export function useOrgMutations(companyId: string | undefined, groupId?: string | null) {
  const queryClient = useQueryClient()

  const createOrgUnitMutation = useMutation({
    mutationFn: ({
      data,
      userId,
    }: {
      data: Omit<OrgUnit, 'id' | 'createdAt' | 'updatedAt'>
      userId: string
    }) => createOrgUnit(companyId!, data, userId, groupId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.orgUnits(companyId!, groupId) })
    },
    onError: (error) => {
      console.error('Error creating org unit:', error)
      toast.error('Failed to create org unit')
    },
  })

  const updateOrgUnitMutation = useMutation({
    mutationFn: ({
      orgUnitId,
      updates,
      userId,
    }: {
      orgUnitId: string
      updates: Partial<OrgUnit>
      userId: string
    }) => updateOrgUnit(companyId!, orgUnitId, updates, userId, groupId ?? undefined),
    onSuccess: (_, { orgUnitId }) => {
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.orgUnits(companyId!, groupId) })
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.orgUnit(companyId!, orgUnitId, groupId) })
    },
    onError: (error) => {
      console.error('Error updating org unit:', error)
      toast.error('Failed to update org unit')
    },
  })

  const deleteOrgUnitMutation = useMutation({
    mutationFn: ({ orgUnitId, userId }: { orgUnitId: string; userId: string }) =>
      deleteOrgUnit(companyId!, orgUnitId, userId, groupId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.orgUnits(companyId!, groupId) })
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.positions(companyId!, groupId) })
    },
    onError: (error) => {
      console.error('Error deleting org unit:', error)
      toast.error('Failed to delete org unit')
    },
  })

  return {
    createOrgUnit: createOrgUnitMutation,
    updateOrgUnit: updateOrgUnitMutation,
    deleteOrgUnit: deleteOrgUnitMutation,
  }
}

export function usePositionMutations(companyId: string | undefined, groupId?: string | null) {
  const queryClient = useQueryClient()

  const createPositionMutation = useMutation({
    mutationFn: ({
      data,
      userId,
    }: {
      data: Omit<Position, 'id' | 'createdAt' | 'updatedAt'>
      userId: string
    }) => createPosition(companyId!, data, userId, groupId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.positions(companyId!, groupId) })
    },
    onError: (error) => {
      console.error('Error creating position:', error)
      toast.error('Failed to create position')
    },
  })

  const updatePositionMutation = useMutation({
    mutationFn: ({
      positionId,
      updates,
      userId,
    }: {
      positionId: string
      updates: Partial<Position>
      userId: string
    }) => updatePosition(companyId!, positionId, updates, userId, groupId ?? undefined),
    onSuccess: (_, { positionId }) => {
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.positions(companyId!, groupId) })
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.position(companyId!, positionId, groupId) })
    },
    onError: (error) => {
      console.error('Error updating position:', error)
      toast.error('Failed to update position')
    },
  })

  const deletePositionMutation = useMutation({
    mutationFn: ({ positionId, userId }: { positionId: string; userId: string }) =>
      deletePosition(companyId!, positionId, userId, groupId ?? undefined),
    onSuccess: (_, { positionId }) => {
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.positions(companyId!, groupId) })
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.currentAssignments(companyId!, positionId, groupId) })
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.activeAssignments(companyId!, groupId) })
    },
    onError: (error) => {
      console.error('Error deleting position:', error)
      toast.error('Failed to delete position')
    },
  })

  const deletePositionsMutation = useMutation({
    mutationFn: ({ positionIds, userId }: { positionIds: string[]; userId: string }) =>
      deletePositions(companyId!, positionIds, userId, groupId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.positions(companyId!, groupId) })
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.activeAssignments(companyId!, groupId) })
    },
    onError: (error) => {
      console.error('Error deleting positions:', error)
      toast.error('Failed to delete positions')
    },
  })

  return {
    createPosition: createPositionMutation,
    updatePosition: updatePositionMutation,
    deletePosition: deletePositionMutation,
    deletePositions: deletePositionsMutation,
  }
}

export function useAssignmentMutations(companyId: string | undefined, groupId?: string | null) {
  const queryClient = useQueryClient()

  const assignUserMutation = useMutation({
    mutationFn: ({
      positionId,
      userId,
      data,
      assignedBy,
    }: {
      positionId: string
      userId: string
      data: {
        assignmentType: 'permanent' | 'temporary' | 'acting'
        startAt: string
        endAt?: string | null
        reason: string
        notes: string
      }
      assignedBy: string
    }) => assignUserToPosition(companyId!, positionId, userId, data, assignedBy, groupId ?? undefined),
    onSuccess: (_, { positionId }) => {
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.activeAssignments(companyId!, groupId) })
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.currentAssignments(companyId!, positionId, groupId) })
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.positions(companyId!, groupId) })
      queryClient.invalidateQueries({ queryKey: ['users', companyId, groupId ?? ''] })
    },
    onError: (error) => {
      console.error('Error assigning user:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to assign user')
    },
  })

  const endAssignmentMutation = useMutation({
    mutationFn: ({
      assignmentId,
      endAt,
      userId,
    }: {
      assignmentId: string
      endAt: string
      userId: string
    }) => endPositionAssignment(companyId!, assignmentId, endAt, userId, groupId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.activeAssignments(companyId!, groupId) })
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.positions(companyId!, groupId) })
      // Invalidate all position assignments (we don't have assignmentId -> positionId here)
      queryClient.invalidateQueries({ queryKey: ['org', 'assignments', companyId] })
      queryClient.invalidateQueries({ queryKey: ['org', 'assignment-history', companyId] })
    },
    onError: (error) => {
      console.error('Error ending assignment:', error)
      toast.error('Failed to end assignment')
    },
  })

  return {
    assignUserToPosition: assignUserMutation,
    endAssignment: endAssignmentMutation,
  }
}
