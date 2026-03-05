/**
 * Centralized Firestore path helpers for multi-org (enterprise groups).
 * Use these instead of string concatenation when reading/writing under enterprise groups.
 */

/** Root path for an enterprise group (groupId === tenantId) */
export function enterpriseGroupPath(groupId: string): string {
  return `enterpriseGroups/${groupId}`
}

/** Path to the companies subcollection under a group */
export function enterpriseGroupCompaniesPath(groupId: string): string {
  return `enterpriseGroups/${groupId}/companies`
}

/** Path to a single company doc under a group */
export function enterpriseGroupCompanyPath(groupId: string, companyId: string): string {
  return `enterpriseGroups/${groupId}/companies/${companyId}`
}

/** Path to the users subcollection under a group */
export function enterpriseGroupUsersPath(groupId: string): string {
  return `enterpriseGroups/${groupId}/users`
}

/** Path to a single user doc under a group */
export function enterpriseGroupUserPath(groupId: string, userId: string): string {
  return `enterpriseGroups/${groupId}/users/${userId}`
}

/**
 * Path to a subcollection under a company (when using enterprise group structure).
 * Example: enterpriseGroupCompanySubcollectionPath(groupId, companyId, 'projects')
 * => enterpriseGroups/{groupId}/companies/{companyId}/projects
 */
export function enterpriseGroupCompanySubcollectionPath(
  groupId: string,
  companyId: string,
  subcollection: string
): string {
  return `enterpriseGroups/${groupId}/companies/${companyId}/${subcollection}`
}

/**
 * Path segments for Firestore collection() under enterprise company.
 * Use: collection(db, ...companyCollectionPathSegments(groupId, companyId, 'workspaces'))
 */
export function companyCollectionPathSegments(
  groupId: string,
  companyId: string,
  subcollection: string
): [string, string, string, string, string] {
  return ['enterpriseGroups', groupId, 'companies', companyId, subcollection]
}

/**
 * Path segments for workspace/project/task collections.
 * Always uses the enterprise group path structure to match Firestore security rules.
 */
export function companySubcollectionPathSegments(
  groupId: string,
  companyId: string,
  subcollection: string
): [string, string, string, string, string] {
  return ['enterpriseGroups', groupId, 'companies', companyId, subcollection]
}
/**
 * Path segments for orgUnits collection under enterprise company.
 * Use: collection(db, ...orgUnitsCollectionPathSegments(groupId, companyId))
 */
export function orgUnitsCollectionPathSegments(
  groupId: string,
  companyId: string
): [string, string, string, string, string] {
  return ['enterpriseGroups', groupId, 'companies', companyId, 'orgUnits']
}

/**
 * Path segments for positions collection under enterprise company.
 * Use: collection(db, ...positionsCollectionPathSegments(groupId, companyId))
 */
export function positionsCollectionPathSegments(
  groupId: string,
  companyId: string
): [string, string, string, string, string] {
  return ['enterpriseGroups', groupId, 'companies', companyId, 'positions']
}
