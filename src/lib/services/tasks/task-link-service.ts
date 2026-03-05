import { db } from '@/lib/firebase'
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    deleteDoc,
    doc,
    getDoc
} from 'firebase/firestore'
import { TaskLink, TaskLinkType, TaskLinkWithDetails } from '@/types/task-links'
import { companySubcollectionPathSegments } from '@/lib/firestore-paths'

export class TaskLinkService {
    /**
     * Create link with access validation (enforced by Firestore rules)
     */
    static async createLink(
        companyId: string,
        sourceTaskId: string,
        targetTaskId: string,
        sourceProjectId: string,
        targetProjectId: string,
        linkType: TaskLinkType,
        userId: string,
        groupId?: string
    ): Promise<TaskLink> {
        const linkData = {
            companyId,
            sourceTaskId,
            targetTaskId,
            sourceProjectId,
            targetProjectId,
            linkType,
            createdBy: userId,
            createdAt: new Date().toISOString()
        }
        const docRef = await addDoc(
            collection(db, ...(companySubcollectionPathSegments(groupId || companyId, companyId, 'taskLinks') as [string, ...string[]])),
            linkData
        )
        return { id: docRef.id, ...linkData }
    }

    /**
     * Get all links for a task and group them for display
     */
    static async getTaskLinksGrouped(companyId: string, taskId: string, groupId?: string): Promise<{
        blocking: TaskLinkWithDetails[]
        blockedBy: TaskLinkWithDetails[]
        clones: TaskLinkWithDetails[]
        clonedBy: TaskLinkWithDetails[]
        duplicates: TaskLinkWithDetails[]
        duplicatedBy: TaskLinkWithDetails[]
        related: TaskLinkWithDetails[]
    }> {
        try {
            const linksRef = collection(db, ...(companySubcollectionPathSegments(groupId || companyId, companyId, 'taskLinks') as [string, ...string[]]))

            // 1. Get outgoing links (source = taskId)
            const outgoingQuery = query(linksRef, where('sourceTaskId', '==', taskId))
            const outgoingSnap = await getDocs(outgoingQuery)

            // 2. Get incoming links (target = taskId)
            const incomingQuery = query(linksRef, where('targetTaskId', '==', taskId))
            const incomingSnap = await getDocs(incomingQuery)

            const results = {
                blocking: [] as TaskLinkWithDetails[],
                blockedBy: [] as TaskLinkWithDetails[],
                clones: [] as TaskLinkWithDetails[],
                clonedBy: [] as TaskLinkWithDetails[],
                duplicates: [] as TaskLinkWithDetails[],
                duplicatedBy: [] as TaskLinkWithDetails[],
                related: [] as TaskLinkWithDetails[]
            }

            // Process Outgoing Links
            const outgoingPromises = outgoingSnap.docs.map(async (linkDoc) => {
                const data = linkDoc.data() as TaskLink
                const enriched = await this.enrichLink(companyId, linkDoc.id, data, data.targetTaskId, groupId)
                if (!enriched) return null

                switch (data.linkType) {
                    case 'blocks':
                        results.blocking.push(enriched)
                        break
                    case 'is_blocked_by':
                        results.blockedBy.push(enriched)
                        break
                    case 'clones':
                        results.clones.push(enriched)
                        break
                    case 'is_cloned_by':
                        results.clonedBy.push(enriched)
                        break
                    case 'duplicates':
                        results.duplicates.push(enriched)
                        break
                    case 'is_duplicated_by':
                        results.duplicatedBy.push(enriched)
                        break
                    case 'relates_to':
                    default:
                        results.related.push(enriched)
                        break
                }
                return enriched
            })

            // Process Incoming Links (Reverse the relationship for the view)
            const incomingPromises = incomingSnap.docs.map(async (linkDoc) => {
                const data = linkDoc.data() as TaskLink
                const enriched = await this.enrichLink(companyId, linkDoc.id, data, data.sourceTaskId, groupId)
                if (!enriched) return null

                // For incoming links, the relationship from the current task's perspective is reversed
                switch (data.linkType) {
                    case 'blocks':
                        results.blockedBy.push(enriched)
                        break
                    case 'is_blocked_by':
                        results.blocking.push(enriched)
                        break
                    case 'clones':
                        results.clonedBy.push(enriched)
                        break
                    case 'is_cloned_by':
                        results.clones.push(enriched)
                        break
                    case 'duplicates':
                        results.duplicatedBy.push(enriched)
                        break
                    case 'is_duplicated_by':
                        results.duplicates.push(enriched)
                        break
                    case 'relates_to':
                    default:
                        if (!results.related.find(r => r.id === linkDoc.id)) {
                            results.related.push(enriched)
                        }
                        break
                }
                return enriched
            })

            await Promise.all([...outgoingPromises, ...incomingPromises])

            return results
        } catch (error: any) {
            // Silently handle permission errors for the main query
            if (error.code !== 'permission-denied') {
                console.error('[TaskLinkService] Failed to fetch task links:', error)
            }
            return { blocking: [], blockedBy: [], clones: [], clonedBy: [], duplicates: [], duplicatedBy: [], related: [] }
        }
    }

    /**
     * Helper to fetch task details for a link
     * Returns null if task is inaccessible or doesn't exist
     */
    private static async enrichLink(
        companyId: string,
        linkId: string,
        linkData: TaskLink,
        relatedTaskId: string,
        groupId?: string
    ): Promise<TaskLinkWithDetails | null> {
        try {
            const taskRef = doc(db, ...(companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks') as [string, ...string[]]), relatedTaskId)
            const taskSnap = await getDoc(taskRef)

            if (!taskSnap.exists()) {
                return null
            }

            const taskData = taskSnap.data()
            let projectCode = taskData?.projectCode

            // Fallback: If projectCode is missing on task, fetch from project document
            if (!projectCode && taskData?.projectId) {
                try {
                    const projectRef = doc(db, ...(companySubcollectionPathSegments(groupId || companyId, companyId, 'projects') as [string, ...string[]]), taskData.projectId)
                    const projectSnap = await getDoc(projectRef)
                    if (projectSnap.exists()) {
                        projectCode = projectSnap.data()?.projectCode || projectSnap.data()?.code
                    }
                } catch (pe) {
                    // SILENT: Project might be private, no need to log
                }
            }

            return {
                ...linkData,
                id: linkId,
                relatedTaskId,
                relatedProjectId: taskData?.projectId || '',
                targetTask: {
                    taskNumber: taskData?.taskNumber?.toString() || '0',
                    projectCode: projectCode || '???',
                    title: taskData?.title || 'Private Task',
                    status: taskData?.status || 'Unknown',
                    assignedToName: taskData?.assignedToName
                }
            }
        } catch (error: any) {
            // SILENT: If permission denied, we just don't show the link as requested
            if (error.code !== 'permission-denied') {
                console.warn('[TaskLinkService] Enrichment skipped for link:', linkId, error.message)
            }
            return null
        }
    }

    /**
     * Delete a link record
     */
    static async deleteLink(companyId: string, linkId: string, groupId?: string): Promise<void> {
        await deleteDoc(doc(db, ...(companySubcollectionPathSegments(groupId || companyId, companyId, 'taskLinks') as [string, ...string[]]), linkId))
    }
}

