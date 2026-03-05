import { collection, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { companyCollectionPathSegments } from '../firestore-paths';
import { Activity } from '@/types/activity-schema';

export class ActivityService {
    /**
     * Log an activity under enterpriseGroups/{groupId}/companies/{companyId}/activities
     */
    static async logActivity(
        groupId: string,
        companyId: string,
        activity: Omit<Activity, 'id' | 'timestamp' | 'companyId'>
    ): Promise<string> {
        const effectiveGroupId = groupId || companyId;
        if (!effectiveGroupId || !companyId) return '';

        try {
            const activityRef = collection(db, ...companyCollectionPathSegments(effectiveGroupId, companyId, 'activities'));
            const now = new Date().toISOString();
            const activityData = { ...activity, companyId, timestamp: now };
            const sanitizedData = JSON.parse(JSON.stringify(activityData));
            const docRef = await addDoc(activityRef, sanitizedData);
            return docRef.id;
        } catch (error: unknown) {
            const code = (error as { code?: string })?.code;
            const isPermissionDenied = code === 'permission-denied' || (error as Error)?.message?.includes('insufficient permissions');
            if (isPermissionDenied) {
                console.warn('Activity log skipped (permissions): ensure user is a member of the enterprise group company.');
                return '';
            }
            console.error('Error logging activity:', error);
            return '';
        }
    }

    /**
     * Get personalized activities for a user
     */
    static async getPersonalActivities(groupId: string, companyId: string, userId: string): Promise<Activity[]> {
        try {
            const activityRef = collection(db, ...companyCollectionPathSegments(groupId, companyId, 'activities'));

            // We want activities where user is Actor OR Recipient
            // Firestore 'or' is limited, so we fetch both and merge
            const [actorSnap, recipientSnap] = await Promise.all([
                getDocs(query(activityRef, where('actorId', '==', userId), orderBy('timestamp', 'desc'), limit(20))),
                getDocs(query(activityRef, where('recipientId', '==', userId), orderBy('timestamp', 'desc'), limit(20)))
            ]);

            const allActivitiesMap = new Map<string, Activity>();

            actorSnap.docs.forEach(doc => {
                allActivitiesMap.set(doc.id, { id: doc.id, ...doc.data() } as Activity);
            });

            recipientSnap.docs.forEach(doc => {
                allActivitiesMap.set(doc.id, { id: doc.id, ...doc.data() } as Activity);
            });

            const activities = Array.from(allActivitiesMap.values());

            // Sort final list
            return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 20);
        } catch (error) {
            console.error('Error getting activities:', error);
            return [];
        }
    }
}
