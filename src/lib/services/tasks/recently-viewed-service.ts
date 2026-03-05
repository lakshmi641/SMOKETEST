import { db } from '@/lib/firebase'
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    updateDoc,
    doc
} from 'firebase/firestore'
import { RecentlyViewedTask } from '@/types/task-links'
import { ProjectService } from '../projects/project-services'
import { companySubcollectionPathSegments } from '@/lib/firestore-paths'

export class RecentlyViewedService {
    /**
     * Track task view (include projectId for access filtering)
     */
    static async trackView(
        companyId: string,
        userId: string,
        task: {
            id: string
            taskNumber: string
            projectCode: string
            projectId: string
            title: string
        },
        groupId?: string
    ): Promise<void> {
        const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'recentlyViewedTasks')
        const historyRef = collection(db, ...(segments as [string, ...string[]]))

        // Check if user already viewed this task recently to update timestamp instead of create new
        const q = query(
            historyRef,
            where('userId', '==', userId),
            where('taskId', '==', task.id),
            limit(1)
        )
        const existing = await getDocs(q)

        if (!existing.empty) {
            const docRef = doc(db, ...(segments as [string, ...string[]]), existing.docs[0]!.id)
            await updateDoc(docRef, { viewedAt: new Date().toISOString() })
            return
        }

        const viewData = {
            companyId,
            userId,
            taskId: task.id,
            taskNumber: task.taskNumber.toString(),
            projectCode: task.projectCode,
            projectId: task.projectId,
            title: task.title,
            viewedAt: new Date().toISOString()
        }

        await addDoc(historyRef, viewData)
    }

    /**
     * Get recently viewed (only tasks user can still access)
     */
    static async getRecentlyViewed(
        companyId: string,
        userId: string,
        isGlobalAdmin: boolean = false,
        maxResults: number = 10,
        groupId?: string
    ): Promise<RecentlyViewedTask[]> {
        const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'recentlyViewedTasks')
        const historyRef = collection(db, ...(segments as [string, ...string[]]))

        // 1. Get raw recently viewed records
        const q = query(
            historyRef,
            where('userId', '==', userId),
            orderBy('viewedAt', 'desc'),
            limit(maxResults * 2) // Fetch more to allow for access filtering
        )
        const snap = await getDocs(q)
        const recentViews = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecentlyViewedTask))

        // 2. Get accessible projects to ensure user still has access
        const accessibleProjects = await ProjectService.getProjects(groupId || companyId, companyId, {
            userId,
            isGlobalAdmin
        })
        const accessibleProjectIds = new Set(accessibleProjects.map(p => p.id))

        // 3. Filter by current access
        return recentViews
            .filter(view => accessibleProjectIds.has(view.projectId))
            .slice(0, maxResults)
    }
}
