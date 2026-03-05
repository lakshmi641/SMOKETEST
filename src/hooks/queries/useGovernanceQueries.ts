import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    updateApprovalLineStatus,
    deleteApprovalLine,
} from '@/lib/services/approval-line-service'
import {
    updateEscalationPathStatus,
    deleteEscalationPath,
} from '@/lib/services/escalation-path-service'
import {
    getApprovalLinesWithValidation,
    getEscalationPathsWithValidation,
} from '@/lib/services/workflow-validation-service'
import type { ApprovalLineStatus, EscalationPathStatus } from '@/types/approval-line-schema'
import toast from 'react-hot-toast'

export const governanceQueryKeys = {
    all: ['governance'] as const,
    approvalLines: (companyId: string, groupId?: string | null) =>
        ['governance', 'approval-lines', companyId, groupId ?? ''] as const,
    escalationPaths: (companyId: string, groupId?: string | null) =>
        ['governance', 'escalation-paths', companyId, groupId ?? ''] as const,
}

export function useApprovalLinesQuery(
    companyId: string | null | undefined,
    groupId?: string | null
) {
    return useQuery({
        queryKey: governanceQueryKeys.approvalLines(companyId ?? '', groupId),
        queryFn: () => getApprovalLinesWithValidation(companyId!, undefined, groupId ?? undefined),
        enabled: !!companyId,
        staleTime: 2 * 60 * 1000,
    })
}

export function useEscalationPathsQuery(
    companyId: string | null | undefined,
    groupId?: string | null
) {
    return useQuery({
        queryKey: governanceQueryKeys.escalationPaths(companyId ?? '', groupId),
        queryFn: () => getEscalationPathsWithValidation(companyId!, undefined, groupId ?? undefined),
        enabled: !!companyId,
        staleTime: 2 * 60 * 1000,
    })
}

export function useApprovalLineMutations(
    companyId: string | null | undefined,
    groupId?: string | null
) {
    const queryClient = useQueryClient()
    const queryKey = governanceQueryKeys.approvalLines(companyId ?? '', groupId)

    const updateStatus = useMutation({
        mutationFn: ({ id, status }: { id: string; status: ApprovalLineStatus }) =>
            updateApprovalLineStatus(companyId!, id, status, 'current-user', groupId ?? undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey })
        },
        onError: (error) => {
            console.error('Error updating approval line status:', error)
            toast.error('Failed to update status')
        },
    })

    const archive = useMutation({
        mutationFn: (id: string) =>
            deleteApprovalLine(companyId!, id, 'current-user', groupId ?? undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey })
        },
        onError: (error) => {
            console.error('Error archiving approval line:', error)
            toast.error('Failed to archive approval line')
        },
    })

    return { updateStatus, archive }
}

export function useEscalationPathMutations(
    companyId: string | null | undefined,
    groupId?: string | null
) {
    const queryClient = useQueryClient()
    const queryKey = governanceQueryKeys.escalationPaths(companyId ?? '', groupId)

    const updateStatus = useMutation({
        mutationFn: ({ id, status }: { id: string; status: EscalationPathStatus }) =>
            updateEscalationPathStatus(companyId!, id, status, 'current-user', groupId ?? undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey })
        },
        onError: (error) => {
            console.error('Error updating escalation path status:', error)
            toast.error('Failed to update status')
        },
    })

    const archive = useMutation({
        mutationFn: (id: string) =>
            deleteEscalationPath(companyId!, id, 'current-user', groupId ?? undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey })
        },
        onError: (error) => {
            console.error('Error archiving escalation path:', error)
            toast.error('Failed to archive escalation path')
        },
    })

    return { updateStatus, archive }
}
