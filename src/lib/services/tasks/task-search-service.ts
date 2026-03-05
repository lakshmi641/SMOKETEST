import { db } from '@/lib/firebase'
import {
    collection,
    getDocs,
    getDoc,
    doc,
    query,
    where,
    limit,
    orderBy
} from 'firebase/firestore'
import { GeneratedTask } from '@/types/task-template-schema'
import { ProjectService } from '../projects/project-services'
import { companySubcollectionPathSegments } from '@/lib/firestore-paths'

/**
 * TASK SEARCH SERVICE
 * 
 * This service handles task search for the Link Work Item dialog.
 * 
 * Key principles (inspired by Jira/Linear):
 * 1. Current project tasks are shown FIRST (context-aware)
 * 2. Search by ID format (MP-1) uses projectId + taskNumber indexes
 * 3. Title search performs client-side filtering after fetching
 * 4. All results are filtered by user's project access rights
 */
export class TaskSearchService {

    /**
     * Main search entry point - context-aware and permission-respecting
     * 
     * @param companyId Company context
     * @param userId Current user for permission filtering
     * @param searchTerm The search query
     * @param isGlobalAdmin If true, bypasses permission checks
     * @param currentProjectId Optional - if provided, prioritizes this project's tasks
     * @param groupId Optional - group context for multi-tenant pathing
     */
    static async searchAccessibleTasks(
        companyId: string,
        userId: string,
        searchTerm: string,
        isGlobalAdmin: boolean = false,
        currentProjectId?: string,
        groupId?: string
    ): Promise<GeneratedTask[]> {
        console.log('[TaskSearchService] Searching:', { companyId, userId, searchTerm, isGlobalAdmin, currentProjectId, groupId })

        if (!companyId) {
            console.warn('[TaskSearchService] Missing companyId')
            return []
        }

        // Allow single character search if it looks like a task ID prefix (e.g., "M" for MP-1)
        const isIdSearch = searchTerm.includes('-') || /^[A-Za-z]{1,4}$/.test(searchTerm.trim())
        const minLength = isIdSearch ? 1 : 2

        if (!searchTerm || searchTerm.trim().length < minLength) {
            console.log('[TaskSearchService] Search term too short')
            return []
        }

        const term = searchTerm.trim()
        const normalizedTerm = term.replace(/\s+/g, '-')

        try {
            // Step 1: Determine search strategy
            let candidates: GeneratedTask[] = []

            // A: Explicit ID Pattern (e.g., "MP-1", "MP 1")
            const isIdPattern = normalizedTerm.includes('-') && /\d+$/.test(normalizedTerm)

            // B: Project Code Prefix Pattern (e.g., "MP", "MP-", "MP ")
            const isProjectPrefix = /^[A-Za-z]{1,4}[-\s]?$/.test(term)

            if (isIdPattern) {
                // ID-based search: "MP-1", "PA 50"
                candidates = await this.searchByTaskIdPattern(companyId, term, currentProjectId, groupId)
            } else if (isProjectPrefix) {
                // Project code lookup: typing "DEF", "DEF-", or "DEF "
                const projectCode = term.replace(/[-\s]/g, '').toUpperCase()
                candidates = await this.searchByProjectCodePrefix(companyId, projectCode, currentProjectId, groupId)

                // Also search by title for these short terms to be safe
                const titleResults = await this.searchByTitleOrDescription(companyId, term, currentProjectId, groupId)
                titleResults.forEach(t => {
                    if (!candidates.find(c => c.id === t.id)) candidates.push(t)
                })
            } else {
                // Title/description search (longer queries or mixed characters)
                candidates = await this.searchByTitleOrDescription(companyId, term, currentProjectId, groupId)
            }

            console.log('[TaskSearchService] Raw candidates found:', candidates.length)

            if (candidates.length === 0) return []

            // Step 2: Validate access for each unique project
            const filteredResults = await this.filterByProjectAccess(
                companyId,
                userId,
                isGlobalAdmin,
                candidates,
                groupId
            )

            console.log('[TaskSearchService] After access filtering:', filteredResults.length)

            // Step 3: Enrich with projectCode for UI display (especially important for older tasks)
            const uniquePIds = Array.from(new Set(filteredResults.map(r => r.projectId).filter(Boolean)))
            const projectCodeMap = new Map<string, string>()

            await Promise.all(uniquePIds.map(async (pid) => {
                const info = await this.getProjectInfo(companyId, pid, groupId)
                if (info?.projectCode) {
                    projectCodeMap.set(pid, info.projectCode)
                }
            }))

            filteredResults.forEach(task => {
                if (!task.projectCode && projectCodeMap.has(task.projectId)) {
                    task.projectCode = projectCodeMap.get(task.projectId)
                }
            })

            return filteredResults

        } catch (error) {
            console.error('[TaskSearchService] Search failed:', error)
            return []
        }
    }

    /**
     * Search by Task ID pattern (e.g., "MP-1", "PA-50", "MP 1")
     */
    private static async searchByTaskIdPattern(
        companyId: string,
        pattern: string,
        currentProjectId?: string,
        groupId?: string
    ): Promise<GeneratedTask[]> {
        // Handle both "DEF-1" and "DEF 1"
        const normalized = pattern.trim().replace(/\s+/g, '-')
        const parts = normalized.split('-')
        const projectCode = parts[0]?.toUpperCase() || ''

        // If it's just "DEF-", don't treat as ID search yet
        if (parts.length === 2 && parts[1] === '') {
            return []
        }

        const taskNumber = parts.length > 1 ? parseInt(parts[1]!) : NaN

        const tasksRef = collection(db, ...(companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks') as [string, ...string[]]))
        const results: GeneratedTask[] = []

        // Strategy A: Search by projectCode + taskNumber (if both are valid)
        if (projectCode && !isNaN(taskNumber)) {
            // Try stored projectCode first
            const q1 = query(
                tasksRef,
                where('projectCode', '==', projectCode),
                where('taskNumber', '==', taskNumber)
            )
            const snap1 = await getDocs(q1)
            console.log('[TaskSearchService] projectCode+taskNumber query:', snap1.size, 'results')
            snap1.docs.forEach(d => results.push({ id: d.id, ...d.data() } as GeneratedTask))
        }

        // Strategy B: If we have currentProjectId, also check if taskNumber matches there
        // This handles tasks that don't have projectCode stored yet
        if (currentProjectId && !isNaN(taskNumber) && results.length === 0) {
            const q2 = query(
                tasksRef,
                where('projectId', '==', currentProjectId),
                where('taskNumber', '==', taskNumber)
            )
            const snap2 = await getDocs(q2)
            console.log('[TaskSearchService] currentProject+taskNumber query:', snap2.size, 'results')
            snap2.docs.forEach(d => {
                // Avoid duplicates
                if (!results.find(r => r.id === d.id)) {
                    results.push({ id: d.id, ...d.data() } as GeneratedTask)
                }
            })
        }

        // Strategy C: Fallback - lookup project by code and search by projectId + taskNumber
        if (results.length === 0 && projectCode && !isNaN(taskNumber)) {
            const project = await this.findProjectByCode(companyId, projectCode, groupId)
            if (project) {
                const q3 = query(
                    tasksRef,
                    where('projectId', '==', project.id),
                    where('taskNumber', '==', taskNumber)
                )
                const snap3 = await getDocs(q3)
                console.log('[TaskSearchService] projectId+taskNumber fallback:', snap3.size, 'results')
                snap3.docs.forEach(d => results.push({ id: d.id, ...d.data() } as GeneratedTask))
            }
        }

        return results
    }

    /**
     * Search by project code prefix (e.g., typing "MP" shows all MP-* tasks)
     */
    private static async searchByProjectCodePrefix(
        companyId: string,
        codePrefix: string,
        currentProjectId?: string,
        groupId?: string
    ): Promise<GeneratedTask[]> {
        const tasksRef = collection(db, ...(companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks') as [string, ...string[]]))
        const results: GeneratedTask[] = []

        // Strategy A: Query tasks with matching projectCode
        const q1 = query(
            tasksRef,
            where('projectCode', '==', codePrefix),
            limit(50)
        )
        const snap1 = await getDocs(q1)
        snap1.docs.forEach(d => results.push({ id: d.id, ...d.data() } as GeneratedTask))

        // Strategy B: Fallback - find project by code and fetch its tasks
        if (results.length === 0) {
            const project = await this.findProjectByCode(companyId, codePrefix, groupId)
            if (project) {
                const q2 = query(
                    tasksRef,
                    where('projectId', '==', project.id),
                    limit(50)
                )
                const snap2 = await getDocs(q2)
                snap2.docs.forEach(d => results.push({ id: d.id, ...d.data() } as GeneratedTask))
            }
        }

        // Strategy C: If currentProjectId is provided and matches, include its tasks
        if (currentProjectId && results.length === 0) {
            const currentProject = await this.getProjectInfo(companyId, currentProjectId, groupId)
            if (currentProject?.projectCode?.toUpperCase().startsWith(codePrefix)) {
                const q3 = query(
                    tasksRef,
                    where('projectId', '==', currentProjectId),
                    limit(50)
                )
                const snap3 = await getDocs(q3)
                snap3.docs.forEach(d => {
                    if (!results.find(r => r.id === d.id)) {
                        results.push({ id: d.id, ...d.data() } as GeneratedTask)
                    }
                })
            }
        }

        return results
    }

    /**
     * Search by title or description
     */
    private static async searchByTitleOrDescription(
        companyId: string,
        searchTerm: string,
        currentProjectId?: string,
        groupId?: string
    ): Promise<GeneratedTask[]> {
        const tasksRef = collection(db, ...(companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks') as [string, ...string[]]))
        const term = searchTerm.toLowerCase()
        const results: GeneratedTask[] = []

        // Strategy A: If we have a currentProjectId, search within that project FIRST
        if (currentProjectId) {
            const q1 = query(
                tasksRef,
                where('projectId', '==', currentProjectId),
                limit(200)
            )
            const snap1 = await getDocs(q1)
            const projectTasks = snap1.docs
                .map(d => ({ id: d.id, ...d.data() } as GeneratedTask))
                .filter(t =>
                    t.title?.toLowerCase().includes(term) ||
                    t.description?.toLowerCase().includes(term)
                )
            results.push(...projectTasks)
        }

        // Strategy B: If no results from current project, search more broadly
        if (results.length < 10) {
            const q2 = query(tasksRef, limit(500))
            const snap2 = await getDocs(q2)
            const globalMatches = snap2.docs
                .map(d => ({ id: d.id, ...d.data() } as GeneratedTask))
                .filter(t =>
                    (t.title?.toLowerCase().includes(term) ||
                        t.description?.toLowerCase().includes(term)) &&
                    !results.find(r => r.id === t.id) // Avoid duplicates
                )
            results.push(...globalMatches)
        }

        return results.slice(0, 30)
    }

    /**
     * Filter candidates by user's project access
     * Uses ProjectService.getProjects which correctly respects:
     * - Workspace membership (for standard projects)
     * - Team membership (for private projects)
     * - Manager-only access (for secret projects)
     */
    private static async filterByProjectAccess(
        companyId: string,
        userId: string,
        isGlobalAdmin: boolean,
        candidates: GeneratedTask[],
        groupId?: string
    ): Promise<GeneratedTask[]> {
        // Get all projects the user can access (this handles workspace + visibility correctly)
        const accessibleProjects = await ProjectService.getProjects(groupId || companyId, companyId, {
            userId,
            isGlobalAdmin
        })

        const accessibleProjectIds = new Set(accessibleProjects.map(p => p.id))

        console.log('[TaskSearchService] Accessible projects:', accessibleProjectIds.size)

        return candidates.filter(task => accessibleProjectIds.has(task.projectId))
    }

    /**
     * Find a project by its projectCode
     */
    private static async findProjectByCode(
        companyId: string,
        projectCode: string,
        groupId?: string
    ): Promise<{ id: string; projectCode: string } | null> {
        try {
            const projectsRef = collection(db, ...(companySubcollectionPathSegments(groupId || companyId, companyId, 'projects') as [string, ...string[]]))
            const q = query(
                projectsRef,
                where('projectCode', '==', projectCode),
                limit(1)
            )
            const snap = await getDocs(q)
            if (!snap.empty) {
                const doc = snap.docs[0]!
                return { id: doc.id, projectCode: doc.data().projectCode }
            }
        } catch (err) {
            console.warn('[TaskSearchService] Failed to find project by code:', err)
        }
        return null
    }

    /**
     * Get basic project info by ID
     */
    private static async getProjectInfo(
        companyId: string,
        projectId: string,
        groupId?: string
    ): Promise<{ id: string; projectCode?: string } | null> {
        try {
            const projectRef = doc(db, ...(companySubcollectionPathSegments(groupId || companyId, companyId, 'projects') as [string, ...string[]]), projectId)
            const snap = await getDoc(projectRef)
            if (snap.exists()) {
                const data = snap.data() as any
                return { id: snap.id, projectCode: data.projectCode }
            }
        } catch (err: any) {
            // SILENT: Fail gracefully if project info is inaccessible
        }
        return null
    }
}

