export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore, verifyIdToken } from '@/lib/firebase-admin'

/**
 * POST /api/tenant/theme
 * Updates tenant branding theme. Requires auth and membership in the tenant's enterprise group
 * (or platform admin). Uses Admin SDK to bypass client Firestore rules.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const idToken = authHeader.slice(7)
    let uid: string
    try {
      const decoded = await verifyIdToken(idToken)
      uid = decoded.uid
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { tenantId, theme } = body as { tenantId?: string; theme?: string }

    if (!tenantId || typeof theme !== 'string') {
      return NextResponse.json(
        { success: false, error: 'tenantId and theme are required' },
        { status: 400 }
      )
    }

    const db = getAdminFirestore()

    // Check platform admin first
    const platformAdminSnap = await db.doc(`platform_admins/${uid}`).get()
    const isPlatformAdmin =
      platformAdminSnap.exists && platformAdminSnap.data()?.status === 'active'

    if (!isPlatformAdmin) {
      // Require user to be in the tenant's enterprise group (tenantId is groupId)
      const groupUserRef = db
        .collection('enterpriseGroups')
        .doc(tenantId)
        .collection('users')
        .doc(uid)
      const groupUserSnap = await groupUserRef.get()
      if (!groupUserSnap.exists) {
        return NextResponse.json(
          { success: false, error: 'Missing or insufficient permissions' },
          { status: 403 }
        )
      }
    }

    const tenantRef = db.collection('tenants').doc(tenantId)
    await tenantRef.update({
      'branding.theme': theme,
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating tenant theme:', error)
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}
