import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { getFirestoreInstance } from '../firebase'
import { EnterpriseGroupUser } from '@/types/enterprise-group-schema'
import { Company, CompanyUser } from '@/types/company-schema'

const convertTimestamps = (data: any): any => {
  if (!data) return data
  const converted = { ...data }
  Object.keys(converted).forEach(key => {
    if (converted[key] instanceof Timestamp) {
      converted[key] = converted[key].toDate().toISOString()
    } else if (typeof converted[key] === 'object' && converted[key] !== null && !(converted[key] instanceof Array)) {
      converted[key] = convertTimestamps(converted[key])
    }
  })
  return converted
}

export class EnterpriseGroupService {
  /**
   * Get all companies under an enterprise group.
   */
  static async getGroupCompanies(groupId: string): Promise<Company[]> {
    const db = getFirestoreInstance()
    const coll = collection(db, 'enterpriseGroups', groupId, 'companies')
    const snap = await getDocs(coll)
    const companies = snap.docs.map(d => ({ id: d.id, ...convertTimestamps(d.data()) } as Company))
    companies.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return companies
  }

  /**
   * Get all users in the enterprise group (group-level user docs).
   */
  static async getGroupUsers(groupId: string): Promise<EnterpriseGroupUser[]> {
    const db = getFirestoreInstance()
    const coll = collection(db, 'enterpriseGroups', groupId, 'users')
    const snap = await getDocs(coll)
    const users = snap.docs.map(d => ({ userId: d.id, ...convertTimestamps(d.data()) } as EnterpriseGroupUser))
    users.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return users
  }

  /**
   * Get users for a specific company under the enterprise group.
   * Primary source of truth: enterpriseGroups/{groupId}/users filtered by companyIds OR primaryCompanyId.
   * Falls back to company-level subcollection if group-level queries return nothing.
   */
  static async getCompanyUsers(groupId: string, companyId: string): Promise<CompanyUser[]> {
    const db = getFirestoreInstance()
    const groupColl = collection(db, 'enterpriseGroups', groupId, 'users')

    const [companyIdsSnap, primarySnap] = await Promise.all([
      getDocs(query(groupColl, where('companyIds', 'array-contains', companyId))),
      getDocs(query(groupColl, where('primaryCompanyId', '==', companyId))),
    ])

    const seen = new Set<string>()
    const users: CompanyUser[] = []

    const mapDoc = (d: import('firebase/firestore').QueryDocumentSnapshot) => {
      if (seen.has(d.id)) return
      seen.add(d.id)
      const data = convertTimestamps(d.data())
      users.push({
        id: d.id,
        userId: d.id,
        name: data.name || '',
        email: data.email || '',
        role: data.roles?.[companyId] || data.role || 'employee',
        companyId,
        ...data,
      } as CompanyUser)
    }

    companyIdsSnap.docs.forEach(mapDoc)
    primarySnap.docs.forEach(mapDoc)

    if (users.length > 0) {
      return users
    }

    const companyColl = collection(db, 'enterpriseGroups', groupId, 'companies', companyId, 'users')
    const companySnap = await getDocs(companyColl)
    if (!companySnap.empty) {
      return companySnap.docs.map(d => ({ id: d.id, ...convertTimestamps(d.data()) } as CompanyUser))
    }

    return []
  }

  /**
   * Resolve user data: try company-level doc first, fall back to group-level doc.
   */
  private static async resolveUserData(
    db: ReturnType<typeof getFirestoreInstance>,
    groupId: string,
    companyId: string,
    userId: string
  ): Promise<{ data: Record<string, any>; fromCompanyLevel: boolean }> {
    const companyUserRef = doc(db, 'enterpriseGroups', groupId, 'companies', companyId, 'users', userId)
    const companySnap = await getDoc(companyUserRef)
    if (companySnap.exists()) {
      return { data: companySnap.data(), fromCompanyLevel: true }
    }

    const groupUserRef = doc(db, 'enterpriseGroups', groupId, 'users', userId)
    const groupSnap = await getDoc(groupUserRef)
    if (groupSnap.exists()) {
      return { data: groupSnap.data(), fromCompanyLevel: false }
    }

    throw new Error('User not found in enterprise group')
  }

  /**
   * Transfer a user from one company to another within the same enterprise group.
   */
  static async transferUser(
    groupId: string,
    userId: string,
    fromCompanyId: string,
    toCompanyId: string,
    newRole?: string
  ): Promise<void> {
    const db = getFirestoreInstance()
    const batch = writeBatch(db)

    const { data: userData, fromCompanyLevel } = await this.resolveUserData(db, groupId, fromCompanyId, userId)

    const sourceUserRef = doc(db, 'enterpriseGroups', groupId, 'companies', fromCompanyId, 'users', userId)
    const targetUserRef = doc(db, 'enterpriseGroups', groupId, 'companies', toCompanyId, 'users', userId)
    const groupUserRef = doc(db, 'enterpriseGroups', groupId, 'users', userId)

    const groupUserSnap = await getDoc(groupUserRef)
    const groupUserData = groupUserSnap.exists() ? groupUserSnap.data() : {}

    const currentCompanyIds: string[] = groupUserData?.companyIds || [fromCompanyId]
    const updatedCompanyIds = currentCompanyIds.filter(id => id !== fromCompanyId)
    if (!updatedCompanyIds.includes(toCompanyId)) {
      updatedCompanyIds.push(toCompanyId)
    }

    const role = newRole || userData.roles?.[fromCompanyId] || userData.role || 'employee'

    batch.set(targetUserRef, {
      ...userData,
      companyId: toCompanyId,
      role,
      updatedAt: Timestamp.now(),
    }, { merge: true })

    if (fromCompanyLevel) {
      batch.delete(sourceUserRef)
    }

    const updatedRoles = { ...(groupUserData?.roles || {}) }
    delete updatedRoles[fromCompanyId]
    updatedRoles[toCompanyId] = role

    batch.set(groupUserRef, {
      companyIds: updatedCompanyIds,
      primaryCompanyId: toCompanyId,
      roles: updatedRoles,
      updatedAt: Timestamp.now(),
    }, { merge: true })

    await batch.commit()
  }

  /**
   * Add a user to an additional company (multi-company access) without removing from current.
   */
  static async addUserToCompany(
    groupId: string,
    userId: string,
    sourceCompanyId: string,
    targetCompanyId: string,
    role: string = 'employee'
  ): Promise<void> {
    const db = getFirestoreInstance()
    const batch = writeBatch(db)

    const { data: userData } = await this.resolveUserData(db, groupId, sourceCompanyId, userId)

    const targetUserRef = doc(db, 'enterpriseGroups', groupId, 'companies', targetCompanyId, 'users', userId)
    const groupUserRef = doc(db, 'enterpriseGroups', groupId, 'users', userId)

    const groupUserSnap = await getDoc(groupUserRef)
    const groupUserData = groupUserSnap.exists() ? groupUserSnap.data() : {}

    const currentCompanyIds: string[] = groupUserData?.companyIds || [sourceCompanyId]
    if (!currentCompanyIds.includes(targetCompanyId)) {
      currentCompanyIds.push(targetCompanyId)
    }

    batch.set(targetUserRef, {
      ...userData,
      companyId: targetCompanyId,
      role,
      updatedAt: Timestamp.now(),
    }, { merge: true })

    const updatedRoles = { ...(groupUserData?.roles || {}) }
    updatedRoles[targetCompanyId] = role

    batch.set(groupUserRef, {
      companyIds: currentCompanyIds,
      roles: updatedRoles,
      updatedAt: Timestamp.now(),
    }, { merge: true })

    await batch.commit()
  }
}
