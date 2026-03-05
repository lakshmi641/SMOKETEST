
import { useCompany } from '@/contexts/CompanyContext'
import { roleHasPermission } from '@/lib/constants/role-permissions'

/**
 * Hook to check if the current user has a specific permission
 * @param permission The permission identifier string (e.g. 'task.create')
 * @returns boolean true if user has permission
 */
export function usePermission(permission: string): boolean {
    const { currentCompanyUser } = useCompany()

    if (!currentCompanyUser || !currentCompanyUser.role) {
        return false
    }

    return roleHasPermission(currentCompanyUser.role, permission)
}
