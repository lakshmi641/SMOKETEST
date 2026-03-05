import { db } from '@/lib/firebase'
import { collection, addDoc, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore'
import { companySubcollectionPathSegments } from '@/lib/firestore-paths'

export interface ProjectActivity {
    id?: string
    projectId: string
    userId: string
    userName?: string
    action: 'created' | 'updated' | 'deleted' | 'completed' | 'started'
    resourceType: 'task' | 'project' | 'comment'
    resourceId: string
    resourceTitle: string
    description?: string
    createdAt: string
}

export class ProjectActivityService {
    /**
     * Log an activity for a project
     */
    static async logActivity(
        companyId: string,
        activity: Omit<ProjectActivity, 'id' | 'createdAt'>,
        groupId?: string
    ): Promise<string | null> {
        try {
            const pathSegments = companySubcollectionPathSegments(
                groupId || companyId,
                companyId,
                'projectActivities'
            ) as [string, ...string[]];
            const activityRef = collection(db, ...pathSegments)
            const activityData = {
                ...activity,
                createdAt: new Date().toISOString(),
            }
            const docRef = await addDoc(activityRef, activityData)
            return docRef.id
        } catch (error: any) {
            // Silently fail if permissions are not set up yet
            if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
                console.warn('Activity tracking not available - Firestore permissions not configured')
                return null
            }
            console.error('Error logging activity:', error)
            return null
        }
    }

    /**
     * Get recent activities for a project
     */
    static async getProjectActivities(
        companyId: string,
        projectId: string,
        limitCount: number = 10,
        groupId?: string
    ): Promise<ProjectActivity[]> {
        try {
            const pathSegments = companySubcollectionPathSegments(
                groupId || companyId,
                companyId,
                'projectActivities'
            ) as [string, ...string[]];
            const activityRef = collection(db, ...pathSegments)
            const q = query(
                activityRef,
                where('projectId', '==', projectId),
                orderBy('createdAt', 'desc'),
                limit(limitCount)
            )
            const snapshot = await getDocs(q)
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectActivity))
        } catch (error: any) {
            // Silently fail if permissions are not set up yet
            if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
                console.warn('Activity tracking not available - Firestore permissions not configured')
                return []
            }
            console.error('Error getting project activities:', error)
            return []
        }
    }

    /**
     * Get a human-readable description of an activity
     */
    static getActivityDescription(activity: ProjectActivity): string {
        const action = activity.action
        const resource = activity.resourceTitle

        switch (activity.action) {
            case 'created':
                return `created ${resource}`
            case 'updated':
                return `updated ${resource}`
            case 'deleted':
                return `deleted ${resource}`
            case 'completed':
                return `completed ${resource}`
            case 'started':
                return `started ${resource}`
            default:
                return `modified ${resource}`
        }
    }
}
