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
import { ProjectService } from './projects/project-services'
import { WorkspaceService } from './workspaces/workspace-service'
import { companyCollectionPathSegments } from '../firestore-paths'
import type { EnhancedProject } from '@/types/project-schema'
import type { Workspace } from '@/types/workspace-schema'

export interface RecentlyViewedProject {
    id: string
    companyId: string
    userId: string
    projectId: string
    projectName: string
    viewedAt: string // ISO timestamp
}

export interface RecentlyViewedWorkspace {
    id: string
    companyId: string
    userId: string
    workspaceId: string
    workspaceName: string
    viewedAt: string // ISO timestamp
}

export class RecentlyViewedService {
    /**
     * Track project view
     */
    static async trackProjectView(
        companyId: string,
        userId: string,
        project: {
            id: string
            name: string
        },
        groupId?: string
    ): Promise<void> {
        const historyRef = collection(db, ...companyCollectionPathSegments(groupId || companyId, companyId, 'recentlyViewedProjects'))

        // Check if user already viewed this project recently to update timestamp instead of create new
        const q = query(
            historyRef,
            where('userId', '==', userId),
            where('projectId', '==', project.id),
            limit(1)
        )
        const existing = await getDocs(q)

        if (!existing.empty) {
            const docRef = doc(db, ...companyCollectionPathSegments(groupId || companyId, companyId, 'recentlyViewedProjects'), existing.docs[0]!.id)
            await updateDoc(docRef, {
                viewedAt: new Date().toISOString(),
                projectName: project.name // Update name in case it changed
            })
            return
        }

        const viewData = {
            companyId,
            userId,
            projectId: project.id,
            projectName: project.name,
            viewedAt: new Date().toISOString()
        }

        await addDoc(historyRef, viewData)
    }

    /**
     * Track workspace view
     */
    static async trackWorkspaceView(
        companyId: string,
        userId: string,
        workspace: {
            id: string
            name: string
        },
        groupId?: string
    ): Promise<void> {
        const historyRef = collection(db, ...companyCollectionPathSegments(groupId || companyId, companyId, 'recentlyViewedWorkspaces'))

        // Check if user already viewed this workspace recently to update timestamp instead of create new
        const q = query(
            historyRef,
            where('userId', '==', userId),
            where('workspaceId', '==', workspace.id),
            limit(1)
        )
        const existing = await getDocs(q)

        if (!existing.empty) {
            const docRef = doc(db, ...companyCollectionPathSegments(groupId || companyId, companyId, 'recentlyViewedWorkspaces'), existing.docs[0]!.id)
            await updateDoc(docRef, {
                viewedAt: new Date().toISOString(),
                workspaceName: workspace.name // Update name in case it changed
            })
            return
        }

        const viewData = {
            companyId,
            userId,
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            viewedAt: new Date().toISOString()
        }

        await addDoc(historyRef, viewData)
    }

    /**
     * Get recently viewed projects (only projects user can still access)
     */
    static async getRecentlyViewedProjects(
        companyId: string,
        userId: string,
        isGlobalAdmin: boolean = false,
        maxResults: number = 10,
        groupId?: string
    ): Promise<RecentlyViewedProject[]> {
        const historyRef = collection(db, ...companyCollectionPathSegments(groupId || companyId, companyId, 'recentlyViewedProjects'))

        // 1. Get raw recently viewed records
        const q = query(
            historyRef,
            where('userId', '==', userId),
            orderBy('viewedAt', 'desc'),
            limit(maxResults * 2) // Fetch more to allow for access filtering
        )
        const snap = await getDocs(q)
        const recentViews = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecentlyViewedProject))

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

    /**
     * Get recently viewed workspaces (only workspaces user can still access)
     */
    static async getRecentlyViewedWorkspaces(
        companyId: string,
        userId: string,
        isGlobalAdmin: boolean = false,
        maxResults: number = 10,
        groupId?: string
    ): Promise<RecentlyViewedWorkspace[]> {
        const historyRef = collection(db, ...companyCollectionPathSegments(groupId || companyId, companyId, 'recentlyViewedWorkspaces'))

        // 1. Get raw recently viewed records
        const q = query(
            historyRef,
            where('userId', '==', userId),
            orderBy('viewedAt', 'desc'),
            limit(maxResults * 2) // Fetch more to allow for access filtering
        )
        const snap = await getDocs(q)
        const recentViews = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecentlyViewedWorkspace))

        // 2. Get accessible workspaces to ensure user still has access
        const accessibleWorkspaces = await WorkspaceService.getWorkspaces(groupId || companyId, companyId, {
            userId,
            isGlobalAdmin
        })
        const accessibleWorkspaceIds = new Set(accessibleWorkspaces.map(w => w.id))

        // 3. Filter by current access
        return recentViews
            .filter(view => accessibleWorkspaceIds.has(view.workspaceId))
            .slice(0, maxResults)
    }
}
