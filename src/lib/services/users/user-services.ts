import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore'
import { getFirestoreInstance, auth } from '../../firebase'
import { User } from '../../../types'
import { mapFirestoreUser } from '@/lib/utils/user-utils'

const convertTimestamps = (data: any): any => {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map(item => convertTimestamps(item));
  }

  if (data instanceof Timestamp) {
    return data.toDate().toISOString();
  }

  if (typeof data === 'object') {
    const converted = { ...data };
    Object.keys(converted).forEach(key => {
      converted[key] = convertTimestamps(converted[key]);
    });
    return converted;
  }

  return data;
}

/** Map group-level user doc to User for a given company context. Pass groupId to preserve enterpriseGroupId for auth/store. */
function mapGroupUserToUser(docId: string, data: any, companyId: string, groupId?: string | null): User {
  const roles = data.roles || {}
  const role = roles[companyId] ?? data.role ?? 'employee'

  // Use centralized mapper for consistency
  return mapFirestoreUser(docId, data, {
    role: role as User['role'],
    companyId: (data.primaryCompanyId as string) ?? companyId,
    enterpriseGroupId: groupId ?? undefined
  })
}

export class UserService {
  /**
   * Get all users for a company. When groupId is provided, reads from
   * enterpriseGroups/{groupId}/users only (source of truth), filtered by companyIds.
   * If mergeCompanyProfiles is true, also fetches company-specific profile data (useful for phone numbers).
   */
  static async getUsers(
    companyId: string,
    groupId?: string | null,
    options: { mergeCompanyProfiles?: boolean } = {}
  ): Promise<User[]> {
    const db = getFirestoreInstance()
    try {
      const useEnterprisePath = typeof groupId === 'string' && groupId.length > 0
      let users: User[] = []

      if (useEnterprisePath) {
        const usersRef = collection(db, 'enterpriseGroups', groupId, 'users')
        const usersQuery = query(usersRef, where('companyIds', 'array-contains', companyId))
        const querySnapshot = await getDocs(usersQuery)
        users = querySnapshot.docs.map(d => mapGroupUserToUser(d.id, d.data(), companyId, groupId))

        // Merge company-specific profile data if requested (fixes missing phone numbers)
        if (options.mergeCompanyProfiles) {
          try {
            const companyUsersRef = collection(db, 'enterpriseGroups', groupId, 'companies', companyId, 'users')
            const companyUsersSnap = await getDocs(companyUsersRef)
            const companyProfiles = new Map(companyUsersSnap.docs.map(d => [d.id, d.data()]))

            users = users.map(user => {
              const profile = companyProfiles.get(user.id)
              if (!profile) return user

              // Merge phone: prioritize group level (source of truth), fallback to company profile
              const mergedPhone = user.contact?.phone ||
                profile.contact?.phone ||
                profile.phoneNumber ||
                profile.phone
              // Merge avatar: prioritize group level, fallback to company profile
              const mergedAvatar = user.avatar || (profile.avatar as string)

              return {
                ...user,
                avatar: mergedAvatar,
                contact: {
                  ...user.contact,
                  phone: mergedPhone && mergedPhone !== 'Not provided' ? mergedPhone : user.contact?.phone
                }
              }
            })
          } catch (profileError) {
            console.warn('[UserService] Failed to merge company profiles:', profileError)
          }
        }
      } else {
        const usersRef = collection(db, 'companies', companyId, 'users')
        const usersQuery = query(usersRef)
        const querySnapshot = await getDocs(usersQuery)
        users = querySnapshot.docs.map(doc => mapFirestoreUser(doc.id, doc.data(), { companyId }))
      }

      return users
    } catch (error) {
      console.error('Error getting users:', error)
      throw error
    }
  }

  /**
   * Get a single user. When groupId is provided, reads from enterpriseGroups/{groupId}/users (source of truth).
   */
  static async getUser(companyId: string, userId: string, groupId?: string | null): Promise<User | null> {
    const db = getFirestoreInstance()
    try {
      if (groupId) {
        const userRef = doc(db, 'enterpriseGroups', groupId, 'users', userId)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const user = mapGroupUserToUser(userSnap.id, userSnap.data(), companyId, groupId)

          // Attempt to fetch company-specific profile for merged contact info (only if group level is empty)
          try {
            if (!user.contact?.phone || user.contact.phone === 'Not provided') {
              const companyUserRef = doc(db, 'enterpriseGroups', groupId, 'companies', companyId, 'users', userId)
              const companyUserSnap = await getDoc(companyUserRef)
              if (companyUserSnap.exists()) {
                const profile = companyUserSnap.data()
                const profilePhone = profile.contact?.phone || profile.phoneNumber || profile.phone
                if (profilePhone && profilePhone !== 'Not provided') {
                  user.contact.phone = profilePhone
                }
              }
            }
          } catch (e) { /* ignore merge failure */ }

          return user
        }
        return null
      }
      const userRef = doc(db, 'companies', companyId, 'users', userId)
      const userSnap = await getDoc(userRef)
      if (userSnap.exists()) {
        return mapFirestoreUser(userSnap.id, userSnap.data(), { companyId })
      }
      return null
    } catch (error) {
      console.error('Error getting user:', error)
      throw error
    }
  }

  /**
   * Create a user via API. When groupId is provided, the user is created at
   * enterpriseGroups/{groupId}/users only (source of truth).
   */
  static async createUser(
    companyId: string,
    userData: Omit<User, 'id'> & { password: string },
    options?: { groupId?: string | null }
  ): Promise<User> {
    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('User must be authenticated to create new users')
      }

      const idToken = await currentUser.getIdToken()
      const groupId = options?.groupId ?? undefined

      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          companyId,
          ...(groupId != null && groupId !== '' && { groupId }),
          name: userData.name,
          email: userData.email,
          password: userData.password,
          role: userData.role,
          orgUnitId: userData.orgUnitId,
          orgUnitName: userData.orgUnitName,
          position: userData.position,
          positionCode: userData.positionCode || '',
          designation: userData.designation || '',
          phone: userData.contact?.phone || '',
          slack: userData.contact?.slack || '',
          skills: userData.skills || [],
          avatar: userData.avatar || '',
        }),
      })

      // Check if response is ok before parsing JSON
      if (!response.ok) {
        let errorMessage = 'Failed to create user'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to create user')
      }

      if (!result.user) {
        throw new Error('User creation succeeded but user data was not returned')
      }

      console.log('User created successfully via API:', result.user.id, 'companyId:', result.user.companyId)

      return result.user as User
    } catch (error) {
      console.error('Error creating user:', error)
      throw error
    }
  }

  static async updateUser(
    companyId: string,
    userId: string,
    updates: Partial<User>,
    actorId?: string,
    groupId?: string | null
  ): Promise<void> {
    const db = getFirestoreInstance()
    try {
      if (groupId) {
        const userRef = doc(db, 'enterpriseGroups', groupId, 'users', userId)
        const userSnap = await getDoc(userRef)
        if (!userSnap.exists()) {
          throw new Error('User not found')
        }
        const data = userSnap.data()
        const payload: Record<string, unknown> = { updatedAt: Timestamp.now() }
        for (const [k, v] of Object.entries(updates)) {
          if (k === 'role') continue
          if (v !== undefined) payload[k] = v
        }
        if (updates.role != null) {
          payload[`roles.${companyId}`] = updates.role
          if (data.primaryCompanyId === companyId) {
            payload.role = updates.role
          }
        }
        await updateDoc(userRef, payload)
      } else {
        const userRef = doc(db, `companies/${companyId}/users`, userId)
        await updateDoc(userRef, {
          ...updates,
          updatedAt: Timestamp.now(),
        })
      }

      if (actorId) {
        try {
          const { ActivityService } = await import('../activity-service');
          await ActivityService.logActivity(companyId, companyId, {
            actorId,
            type: 'profile_updated',
            entityId: userId,
            entityType: 'user',
            entityName: 'Profile',
            recipientId: userId !== actorId ? userId : undefined
          });
        } catch (err) {
          console.error('Failed to log profile update activity:', err);
        }
      }
    } catch (error) {
      console.error('Error updating user:', error)
      throw error
    }
  }

  static async deleteUser(companyId: string, userId: string, groupId?: string | null): Promise<void> {
    const db = getFirestoreInstance()
    try {
      // End all active position assignments before deleting user
      const { query: q, collection: col, where: wh, getDocs: getD, updateDoc: updDoc } = await import('firebase/firestore')
      const assignmentsPath = groupId
        ? `enterpriseGroups/${groupId}/companies/${companyId}/positionAssignments`
        : `companies/${companyId}/positionAssignments`

      const assignmentsQuery = q(
        col(db, assignmentsPath),
        wh('userId', '==', userId),
        wh('status', '==', 'active')
      )
      const assignmentsSnap = await getD(assignmentsQuery)
      const now = new Date().toISOString()
      const endPromises = assignmentsSnap.docs.map(docSnap =>
        updDoc(docSnap.ref, { status: 'ended', endAt: now, updatedAt: now })
      )
      await Promise.all(endPromises)
      console.log(`[UserService] Ended ${assignmentsSnap.size} active position assignments for user ${userId}`)

      if (groupId) {
        const userRef = doc(db, 'enterpriseGroups', groupId, 'users', userId)
        await deleteDoc(userRef)
        console.log(`[UserService] User ${userId} deleted from enterpriseGroups/${groupId}/users`)
      } else {
        const userRef = doc(db, `companies/${companyId}/users`, userId)
        await deleteDoc(userRef)
        console.log(`[UserService] User ${userId} deleted successfully`)
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      throw error
    }
  }
}
