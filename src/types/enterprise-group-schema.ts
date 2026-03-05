/**
 * Enterprise group (multi-org) schema.
 * tenantId === enterpriseGroupId. Companies and users live under the group.
 */

export interface EnterpriseGroup {
  id: string
  name?: string
  createdAt: string
  updatedAt: string
}

/** Per-company role for a user in the group */
export type EnterpriseGroupUserRole = 'admin' | 'manager' | 'employee' | 'owner' | 'viewer'

/**
 * User document under enterpriseGroups/{groupId}/users/{userId}.
 * Replaces company-scoped user for login; supports multiple companies and primary company.
 */
export interface EnterpriseGroupUser {
  userId: string
  enterpriseGroupId: string
  /** Companies in this group the user can access */
  companyIds: string[]
  /** Default company after login; must be in companyIds */
  primaryCompanyId: string
  /** Per-company role. Key = companyId */
  roles?: Record<string, EnterpriseGroupUserRole>
  /** Profile fields (name, email, etc.) - can mirror CompanyUser */
  name?: string
  email?: string
  role?: EnterpriseGroupUserRole
  position?: string
  avatar?: string
  createdAt: string
  updatedAt: string
}
