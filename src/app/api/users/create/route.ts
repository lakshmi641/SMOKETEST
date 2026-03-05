export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminFirestore, verifyIdToken } from '@/lib/firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'
import type { DocumentReference, Firestore } from 'firebase-admin/firestore'
import type { User } from '@/types'

function getUsersDocRef(
  db: Firestore,
  companyId: string,
  userId: string,
  groupId?: string | null
): DocumentReference {
  if (groupId) {
    return db
      .collection('enterpriseGroups')
      .doc(groupId)
      .collection('companies')
      .doc(companyId)
      .collection('users')
      .doc(userId)
  }
  return db.collection('companies').doc(companyId).collection('users').doc(userId)
}

/**
 * POST /api/users/create
 * Create a new user using Firebase Admin SDK
 * This endpoint creates users without signing them in, preventing logout of the current user
 */
export async function POST(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    // Verify the ID token
    const idToken = authHeader.substring(7) // Remove 'Bearer ' prefix
    let decodedToken
    try {
      decodedToken = await verifyIdToken(idToken)
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message || 'Invalid or expired authentication token' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      companyId,
      groupId,
      name,
      email,
      password,
      role,
      orgUnitId,
      orgUnitName,
      position,
      positionCode,
      designation,
      phone,
      slack,
      skills,
      avatar,
    } = body

    // Validate required fields
    if (!companyId || !name || !email || !password) {
      console.error('Missing required fields:', { companyId, name, email, hasPassword: !!password })
      return NextResponse.json(
        { success: false, error: 'Missing required fields: companyId, name, email, password' },
        { status: 400 }
      )
    }

    console.log('Creating user with companyId:', companyId, 'groupId:', groupId ?? 'none', 'email:', email)

    // Validate email format
    if (!email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = ['admin', 'manager', 'employee']
    if (role && !validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      )
    }

    // Get Firebase Admin services
    const adminAuth = getAdminAuth()
    const adminFirestore = getAdminFirestore()

    // Check if user already exists in Firebase Auth
    let firebaseUser
    try {
      firebaseUser = await adminAuth.getUserByEmail(email)

      // User exists in Auth. Check if they exist in Firestore (same path we write to)
      const userDocRef = getUsersDocRef(adminFirestore, companyId, firebaseUser.uid, groupId)
      const userDoc = await userDocRef.get()

      if (userDoc.exists) {
        // User already exists in both Auth and Firestore -> Real duplicate
        return NextResponse.json(
          { success: false, error: 'User with this email already exists' },
          { status: 409 }
        )
      }

      // User exists in Auth but NOT in Firestore -> Previously deleted
      // We will "reactivate" them by recreating the Firestore doc
      console.log('User exists in Auth but not Firestore. Reactivating user:', firebaseUser.uid)

      // Update user details in Auth
      await adminAuth.updateUser(firebaseUser.uid, {
        password,
        displayName: name,
        emailVerified: false
      })

    } catch (error: any) {
      // If error is not "user not found", rethrow
      if (error.code !== 'auth/user-not-found') {
        throw error
      }

      // User doesn't exist in Auth, create new user
      firebaseUser = await adminAuth.createUser({
        email,
        password,
        displayName: name,
        emailVerified: false,
      })
    }

    // IMPORTANT: Use the Firebase Auth UID as the Firestore document ID
    const firebaseAuthUID = firebaseUser.uid

    // Create user document in Firestore (enterprise path when groupId provided)
    const now = Timestamp.now()
    // Temporary password metadata for onboarding
    const TEMP_PASSWORD_LIFETIME_HOURS = 72
    const temporaryPasswordExpiresAt = Timestamp.fromDate(
      new Date(Date.now() + TEMP_PASSWORD_LIFETIME_HOURS * 60 * 60 * 1000)
    )
    const userDocData = {
      email,
      name,
      role: role || 'employee',
      orgUnitId: orgUnitId || '',
      orgUnitName: orgUnitName || '',
      position: position || '',
      positionCode: positionCode || '',
      designation: designation || '',
      avatar: avatar || '',
      skills: skills || [],
      contact: {
        phone: phone || '',
        slack: slack || '',
      },
      companyId,
      createdAt: now,
      updatedAt: now,
      mustChangePassword: true,
      temporaryPasswordExpiresAt,
    }

    if (groupId) {
      // Enterprise group: create only group-level user doc (no duplicate at enterpriseGroups/{id}/companies/{id}/users)
      const groupUserData = {
        userId: firebaseAuthUID,
        enterpriseGroupId: groupId,
        companyIds: [companyId],
        primaryCompanyId: companyId,
        roles: { [companyId]: role || 'employee' },
        name,
        email,
        role: role || 'employee',
        orgUnitId: orgUnitId || '',
        orgUnitName: orgUnitName || '',
        position: position || '',
        positionCode: positionCode || '',
        designation: designation || '',
        avatar: avatar || '',
        skills: skills || [],
        contact: { phone: phone || '', slack: slack || '' },
        createdAt: now,
        updatedAt: now,
        mustChangePassword: true,
        temporaryPasswordExpiresAt,
      }
      const groupUserRef = adminFirestore.collection('enterpriseGroups').doc(groupId).collection('users').doc(firebaseAuthUID)
      try {
        await groupUserRef.set(groupUserData)
      } catch (firestoreError: any) {
        console.error('Failed to create enterprise group user document:', firestoreError)
        try {
          await adminAuth.deleteUser(firebaseAuthUID)
        } catch (cleanupError) {
          console.error('Cleanup failed:', cleanupError)
        }
        throw firestoreError
      }
      // Update adminUsers on group company for admin role
      if (role === 'admin') {
        const groupCompanyRef = adminFirestore.collection('enterpriseGroups').doc(groupId).collection('companies').doc(companyId)
        const companyDoc = await groupCompanyRef.get()
        if (companyDoc.exists) {
          const companyData = companyDoc.data()
          const adminUsers = companyData?.adminUsers || []
          if (!adminUsers.includes(firebaseAuthUID)) {
            await groupCompanyRef.update({
              adminUsers: [...adminUsers, firebaseAuthUID],
              updatedAt: Timestamp.now(),
            })
          }
        }
      }
    } else {
      const userDocRef = getUsersDocRef(adminFirestore, companyId, firebaseAuthUID, groupId)
      await userDocRef.set(userDocData)

      const verifyDoc = await userDocRef.get()
      if (!verifyDoc.exists) {
        throw new Error('Failed to create user document in Firestore')
      }
    }

    const pathDesc = groupId
      ? `enterpriseGroups/${groupId}/users/${firebaseAuthUID}`
      : `companies/${companyId}/users/${firebaseAuthUID}`
    console.log('User created successfully with companyId:', companyId, 'uid:', firebaseAuthUID, 'path:', pathDesc)
    console.log('Firebase Auth UID matches Firestore document ID:', firebaseAuthUID)

    // Return the created user object
    // The id field uses the same Firebase Auth UID for consistency
    const createdUser: User = {
      id: firebaseAuthUID,
      email,
      name,
      role: (role || 'employee') as 'admin' | 'manager' | 'employee',
      orgUnitId: orgUnitId || undefined,
      orgUnitName: orgUnitName || undefined,
      position: position || '',
      avatar: avatar || '',
      skills: skills || [],
      contact: {
        phone: phone || '',
        slack: slack || '',
      },
      companyId,
      mustChangePassword: true,
      temporaryPasswordExpiresAt: temporaryPasswordExpiresAt.toDate().toISOString(),
      createdAt: userDocData.createdAt.toDate().toISOString(),
      updatedAt: userDocData.updatedAt.toDate().toISOString(),
    }

    // Note: Invitation email is now handled automatically by a Firestore trigger
    // on enterpriseGroups/{groupId}/users/{userId}

    return NextResponse.json({
      success: true,
      user: createdUser,
    })
  } catch (error: any) {
    console.error('Error creating user:', error)

    // Handle specific Firebase errors
    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json(
        { success: false, error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    if (error.code === 'auth/invalid-email') {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      )
    }

    if (error.code === 'auth/weak-password') {
      return NextResponse.json(
        { success: false, error: 'Password is too weak' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create user',
        message: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

