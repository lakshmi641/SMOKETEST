import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth'
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import { auth, getFirestoreInstance } from './firebase'
import { User } from '../types'
import { enterpriseGroupUserPath } from './firestore-paths'
import { mapFirestoreUser } from './utils/user-utils'

/** Build User from Firestore data (handles Timestamp → string) */
function toUser(id: string, data: Record<string, unknown>, extras: Partial<User> = {}): User {
  return mapFirestoreUser(id, data, extras)
}

export const authService = {
  async signIn(email: string, password: string, companyId?: string) {
    try {
      // companyId from layout is tenant/group id (subdomain resolution). Use as groupId for enterprise groups.
      const groupId = companyId
        // 1) Ensure we are at the Project Root (sincegroupId is not a valid Tenant ID)
        ; (auth as any).tenantId = null
      console.log('Attempting Root Project login for:', email)

      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      console.log('Firebase Auth sign-in successful for UID:', user.uid, 'email:', email, 'groupId:', groupId)

      let userData: User | null = null
      const db = getFirestoreInstance()

      if (groupId) {
        // 1) Try Outer Path: enterpriseGroups/{groupId}/users/{userId}
        const groupUserRef = doc(db, enterpriseGroupUserPath(groupId, user.uid))
        const groupUserDoc = await getDoc(groupUserRef)

        if (groupUserDoc.exists()) {
          const data = groupUserDoc.data() as Record<string, unknown>
          const mustChangePassword = Boolean((data as any).mustChangePassword)
          const tempExpiryRaw = (data as any).temporaryPasswordExpiresAt

          let temporaryPasswordExpiresAtIso: string | undefined
          let isTempPasswordExpired = false

          if (tempExpiryRaw) {
            let expiryDate: Date | null = null
            if (tempExpiryRaw instanceof Timestamp) {
              expiryDate = tempExpiryRaw.toDate()
            } else if (typeof tempExpiryRaw === 'string') {
              const parsed = new Date(tempExpiryRaw)
              if (!isNaN(parsed.getTime())) {
                expiryDate = parsed
              }
            }

            if (expiryDate) {
              temporaryPasswordExpiresAtIso = expiryDate.toISOString()
              if (expiryDate.getTime() < Date.now()) {
                isTempPasswordExpired = true
              }
            }
          }

          if (mustChangePassword && isTempPasswordExpired) {
            await signOut(auth)
            const error = new Error(
              'Your temporary password has expired. Please use Forgot password or contact your administrator for a new invite.'
            )
            ;(error as any).code = 'TEMP_PASSWORD_EXPIRED'
            throw error
          }

          const primaryCompanyId = (data.primaryCompanyId as string) ?? (data.companyIds as string[])?.[0]
          if (!primaryCompanyId) {
            await signOut(auth)
            throw new Error('Access denied. User has no company in this organization.')
          }
          // Check tenant status (tenantId === groupId)
          const tenantRef = doc(db, 'tenants', groupId)
          const tenantSnap = await getDoc(tenantRef)
          if (tenantSnap.exists()) {
            const tenantData = tenantSnap.data()
            if (tenantData?.status === 'inactive' || tenantData?.status === 'suspended') {
              await signOut(auth)
              throw new Error('This organization is inactive. Please contact support.')
            }
          }
          const companyIds = (data.companyIds as string[]) ?? [primaryCompanyId]
          const rolesMap = (data.roles as Record<string, string>) ?? {}
          const topLevelRole = data.role as string
          const isGroupAdmin = topLevelRole === 'group_admin'
          const roleForPrimary = isGroupAdmin ? 'group_admin' : (rolesMap[primaryCompanyId] ?? topLevelRole)
          userData = toUser(user.uid, data, {
            companyId: primaryCompanyId,
            enterpriseGroupId: groupId,
            companyIds,
            primaryCompanyId,
            role: (roleForPrimary as User['role']) ?? 'employee',
            roles: rolesMap as User['roles'],
            isGroupAdmin,
            mustChangePassword,
            temporaryPasswordExpiresAt: temporaryPasswordExpiresAtIso,
          })
          console.log('User resolved from Outer Path (enterpriseGroups/users):', groupId, 'primaryCompanyId:', primaryCompanyId)
        } else {
          // 2) Try Inner Path: enterpriseGroups/{groupId}/companies/{companyId}/users/{userId}
          // Since we might not know the companyId for a generic group login, we search the companies
          const companySnap = await getDocs(collection(db, 'enterpriseGroups', groupId, 'companies'))
          let found = false
          for (const companyDoc of companySnap.docs) {
            const userDoc = await getDoc(doc(db, 'enterpriseGroups', groupId, 'companies', companyDoc.id, 'users', user.uid))
            if (userDoc.exists()) {
              const data = userDoc.data() as Record<string, unknown>
              userData = toUser(user.uid, data, {
                companyId: companyDoc.id,
                enterpriseGroupId: groupId,
                companyIds: [companyDoc.id],
                primaryCompanyId: companyDoc.id
              })
              found = true
              console.log('User resolved from Inner Path (enterpriseGroups/companies/users):', companyDoc.id)
              break
            }
          }
          if (!found) {
            console.error('User document not found in any path for group:', groupId, 'for UID:', user.uid)
            await signOut(auth)
            throw new Error('Access denied. You do not have access to this organization. Please contact your administrator.')
          }
        }
      } else {
        console.warn('No companyId (groupId) provided during login')
        await signOut(auth)
        throw new Error('Access denied. No organization context provided.')
      }

      return userData
    } catch (error: any) {
      console.error('Sign in error:', error)
      // Re-enable auth cleanup if needed
      if (auth.currentUser) await signOut(auth)

      if (error.message && (error.message.includes('Access denied') || error.message.includes('not found') || error.message.includes('inactive'))) {
        throw error
      }
      if (error.code === 'TEMP_PASSWORD_EXPIRED' || error.message?.includes('temporary password has expired')) {
        throw error
      }
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        throw new Error('Invalid email or password')
      }
      if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address')
      }
      if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many failed login attempts. Please try again later.')
      }
      throw error
    }
  },

  async signUp(email: string, password: string, userData: Omit<User, 'id' | 'email' | 'createdAt' | 'updatedAt'>) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      const now = new Date()

      const groupId = userData.companyId // Assuming companyId passed from signup is intended to be the groupId
      const db = getFirestoreInstance()

      // 1. Create organization user profile (Group Level)
      // Path: enterpriseGroups/{groupId}/users/{userId}
      const groupUserRef = doc(db, 'enterpriseGroups', groupId, 'users', user.uid)
      const groupUserData = {
        ...userData,
        id: user.uid,
        email,
        primaryCompanyId: userData.companyId,
        companyIds: [userData.companyId],
        createdAt: now,
        updatedAt: now
      }
      await setDoc(groupUserRef, groupUserData)

      // 2. Create company-specific user profile (Company Level)
      // Path: enterpriseGroups/{groupId}/companies/{companyId}/users/{userId}
      const companyUserRef = doc(db, 'enterpriseGroups', groupId, 'companies', userData.companyId, 'users', user.uid)
      await setDoc(companyUserRef, {
        ...userData,
        id: user.uid,
        email,
        createdAt: now,
        updatedAt: now
      })

      return {
        ...groupUserData,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      } as User
    } catch (error) {
      console.error('Sign up error:', error)
      throw error
    }
  },

  async signOut() {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    }
  },

  onAuthStateChanged(callback: (user: User | null) => void, companyId?: string | (() => string | undefined)) {
    return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          // Resolve companyId - can be a string or a getter function
          const resolvedCompanyId = typeof companyId === 'function' ? companyId() : companyId

          let userData = null

          // If group/company id is provided (from subdomain), validate user in that org
          if (resolvedCompanyId) {
            const groupId = resolvedCompanyId
            console.log('Validating auth state against group/company:', groupId)
            const db = getFirestoreInstance()

            // 1) Try Outer Path: enterpriseGroups/{groupId}/users/{userId}
            const groupUserRef = doc(db, enterpriseGroupUserPath(groupId, firebaseUser.uid))
            const groupUserDoc = await getDoc(groupUserRef)
            if (groupUserDoc.exists()) {
              const data = groupUserDoc.data() as Record<string, unknown>
              const primaryCompanyId = (data.primaryCompanyId as string) ?? (data.companyIds as string[])?.[0]
          if (!primaryCompanyId) {
            await signOut(auth)
            callback(null)
            return
          }

          const mustChangePassword = Boolean((data as any).mustChangePassword)
          const tempExpiryRaw = (data as any).temporaryPasswordExpiresAt

          let temporaryPasswordExpiresAtIso: string | undefined
          let isTempPasswordExpired = false

          if (tempExpiryRaw) {
            let expiryDate: Date | null = null
            if (tempExpiryRaw instanceof Timestamp) {
              expiryDate = tempExpiryRaw.toDate()
            } else if (typeof tempExpiryRaw === 'string') {
              const parsed = new Date(tempExpiryRaw)
              if (!isNaN(parsed.getTime())) {
                expiryDate = parsed
              }
            }

            if (expiryDate) {
              temporaryPasswordExpiresAtIso = expiryDate.toISOString()
              if (expiryDate.getTime() < Date.now()) {
                isTempPasswordExpired = true
              }
            }
          }

          if (mustChangePassword && isTempPasswordExpired) {
            await signOut(auth)
            callback(null)
            return
          }
              const companyIds = (data.companyIds as string[]) ?? [primaryCompanyId]
              const rolesMap = (data.roles as Record<string, string>) ?? {}
              const topLevelRole = data.role as string
              const isGroupAdmin = topLevelRole === 'group_admin'
              const roleForPrimary = isGroupAdmin ? 'group_admin' : (rolesMap[primaryCompanyId] ?? topLevelRole)
              userData = toUser(firebaseUser.uid, data, {
                companyId: primaryCompanyId,
                enterpriseGroupId: groupId,
                companyIds,
                primaryCompanyId,
                role: (roleForPrimary as User['role']) ?? 'employee',
                roles: rolesMap as User['roles'],
                isGroupAdmin,
                mustChangePassword,
                temporaryPasswordExpiresAt: temporaryPasswordExpiresAtIso,
              })
            } else {
              // 2) Try Inner Path: enterpriseGroups/{groupId}/companies/{companyId}/users/{userId}
              const companySnap = await getDocs(collection(db, 'enterpriseGroups', groupId, 'companies'))
              let found = false
              for (const companyDoc of companySnap.docs) {
                const userDoc = await getDoc(doc(db, 'enterpriseGroups', groupId, 'companies', companyDoc.id, 'users', firebaseUser.uid))
                if (userDoc.exists()) {
                  const data = userDoc.data() as Record<string, unknown>
                  userData = toUser(firebaseUser.uid, data, {
                    companyId: companyDoc.id,
                    enterpriseGroupId: groupId,
                    companyIds: [companyDoc.id],
                    primaryCompanyId: companyDoc.id
                  })
                  found = true
                  break
                }
              }
              if (!found) {
                console.error('User not found in any path for group:', groupId, 'for UID:', firebaseUser.uid)
                await signOut(auth)
                callback(null)
                return
              }
            }
          } else {
            console.log('No companyId provided during auth state change')
            callback(null)
            return
          }

          callback(userData)
        } catch (error) {
          console.error('Error fetching user data:', error)
          callback(null)
        }
      } else {
        callback(null)
      }
    })
  }
}
