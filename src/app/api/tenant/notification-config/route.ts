import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, verifyIdToken } from '@/lib/firebase-admin';
import { TenantService } from '@/lib/services/external-notifications/tenant-service';
import type { TenantNotificationConfig } from '@/types/tenant-schema';

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization')
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

        const body = await req.json();
        const { companyId, groupId, config } = body as {
            companyId: string;
            groupId?: string;
            config: Omit<TenantNotificationConfig, 'createdAt' | 'updatedAt'>;
        };

        if (!companyId || !config) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const db = getAdminFirestore()

        // Authorization check - restrict to platform admins or enterprise group admins
        const platformAdminSnap = await db.doc(`platform_admins/${uid}`).get()
        const isPlatformAdmin =
            platformAdminSnap.exists && platformAdminSnap.data()?.status === 'active'

        if (!isPlatformAdmin && groupId) {
            // Require user to be in the tenant's enterprise group
            const groupUserRef = db
                .collection('enterpriseGroups')
                .doc(groupId)
                .collection('users')
                .doc(uid)
            const groupUserSnap = await groupUserRef.get()

            if (!groupUserSnap.exists) {
                return NextResponse.json(
                    { success: false, error: 'Missing or insufficient permissions' },
                    { status: 403 }
                )
            }
        } else if (!isPlatformAdmin && !groupId) {
            // If no groupId (legacy mode), check if user is admin in the company
            const companyAdminRef = db
                .collection('companies')
                .doc(companyId)
                .collection('users')
                .doc(uid)
            const companyAdminSnap = await companyAdminRef.get()

            if (!companyAdminSnap.exists || companyAdminSnap.data()?.role !== 'admin') {
                return NextResponse.json(
                    { success: false, error: 'Missing or insufficient permissions' },
                    { status: 403 }
                )
            }
        }

        // Use Admin SDK for writes to bypass Firestore security rules
        try {
            const effectiveGroupId = groupId || companyId;
            const configRef = db.doc(`enterpriseGroups/${effectiveGroupId}/companies/${companyId}/tenantConfigs/config`);
            const now = new Date().toISOString();

            console.log(`[NotificationConfig] Saving to path: enterpriseGroups/${effectiveGroupId}/companies/${companyId}/tenantConfigs/config`);

            const dataToSave = {
                ...config,
                companyId,
                updatedAt: now,
            };

            const snapshot = await configRef.get();
            if (snapshot.exists) {
                await configRef.update(dataToSave);
                console.log('[NotificationConfig] Updated existing config');
            } else {
                await configRef.set({
                    ...dataToSave,
                    createdAt: now,
                });
                console.log('[NotificationConfig] Created new config');
            }
        } catch (error: any) {
            console.error('[NotificationConfig] Error saving config via Admin SDK:', error);
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error updating tenant notification config:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to update configuration' },
            { status: 500 }
        );
    }
}
