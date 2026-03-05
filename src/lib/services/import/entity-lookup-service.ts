/**
 * Entity Lookup Service
 * 
 * Fetches and caches entities (users, departments, teams) for resolution.
 * Optimized for bulk resolution during import.
 */

import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { companyCollectionPathSegments } from '../../firestore-paths';
import { User } from '@/types/index';
import { OrgUnit } from '@/types/org-schema';
import { ResolutionResult } from './types/import-types';
import { SpellCheckService } from './spell-check-service';

export class EntityLookupService {
    private static userCache: Map<string, User[]> = new Map();
    private static deptCache: Map<string, OrgUnit[]> = new Map();
    private static teamCache: Map<string, any[]> = new Map();
    private static projectCache: Map<string, any[]> = new Map();
    private static positionCache: Map<string, any[]> = new Map();
    private static taskCache: Map<string, any[]> = new Map();
    private static taskTypeCache: Map<string, any[]> = new Map();
    private static requirementTypeCache: Map<string, any[]> = new Map();

    /**
     * Fetch all users for a company and cache them
     */
    static async fetchUsers(companyId: string): Promise<User[]> {
        if (this.userCache.has(companyId)) {
            return this.userCache.get(companyId)!;
        }

        try {
            const q = query(collection(db, 'companies', companyId, 'users'));
            const snapshot = await getDocs(q);
            const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));

            this.userCache.set(companyId, users);
            return users;
        } catch (error: any) {
            console.error(`Failed to fetch users for company ${companyId}:`, error?.message || error);
            this.userCache.set(companyId, []);
            return [];
        }
    }

    /**
     * Fetch all users for a specific workspace. When groupId is provided (multi-org), reads from
     * enterpriseGroups/{groupId}/companies/{companyId}/workspaces and users.
     */
    static async fetchWorkspaceUsers(companyId: string, workspaceId: string, groupId?: string | null): Promise<User[]> {
        const cacheKey = groupId ? `${groupId}:${companyId}:${workspaceId}` : `${companyId}:${workspaceId}`;
        if (this.userCache.has(cacheKey)) {
            return this.userCache.get(cacheKey)!;
        }

        const useEnterprisePath = typeof groupId === 'string' && groupId.length > 0;

        try {
            const workspaceRef = useEnterprisePath
                ? doc(db, ...companyCollectionPathSegments(groupId, companyId, 'workspaces'), workspaceId)
                : doc(db, 'companies', companyId, 'workspaces', workspaceId);
            const workspaceSnap = await getDoc(workspaceRef);

            const memberIds = new Set<string>();

            if (workspaceSnap.exists()) {
                const data = workspaceSnap.data();
                const oldSpocIds = Array.isArray(data.spocIds) ? data.spocIds : [];
                const members = Array.isArray(data.members) ? data.members : oldSpocIds;
                members.forEach((id: string) => memberIds.add(id));

                const oldAdminIds = Array.isArray(data.adminIds) ? data.adminIds : [];
                const ownerId = data.ownerId || (oldAdminIds.length > 0 ? oldAdminIds[0] : null);
                if (ownerId) {
                    memberIds.add(ownerId);
                }
                if (data.createdBy) {
                    memberIds.add(data.createdBy);
                }
            }

            const assignmentsRef = useEnterprisePath
                ? collection(db, ...companyCollectionPathSegments(groupId, companyId, 'roleAssignments'))
                : collection(db, 'companies', companyId, 'roleAssignments');
            const q = query(
                assignmentsRef,
                where('scopeType', '==', 'workspace'),
                where('scopeId', '==', workspaceId),
                where('status', '==', 'active')
            );
            const roleSnap = await getDocs(q);
            roleSnap.docs.forEach(d => {
                const data = d.data();
                if (data.userId) memberIds.add(data.userId);
            });

            const usersRef = useEnterprisePath
                ? collection(db, ...companyCollectionPathSegments(groupId, companyId, 'users'))
                : collection(db, 'companies', companyId, 'users');
            const usersSnap = await getDocs(usersRef);
            const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User));

            let workspaceName = '';
            let workspaceTeamName = '';
            if (workspaceSnap.exists()) {
                const data = workspaceSnap.data();
                workspaceName = (data.name || '').toLowerCase().trim();
                workspaceTeamName = (data.teamName || '').toLowerCase().trim();
            }

            const workspaceUsers = allUsers.filter(u => {
                if (memberIds.has(u.id)) return true;
                if (Array.isArray(u.spocTeams)) {
                    return u.spocTeams.some(t => {
                        const nt = t.toLowerCase().trim();
                        return (workspaceName && nt === workspaceName) || (workspaceTeamName && nt === workspaceTeamName);
                    });
                }
                return false;
            });

            this.userCache.set(cacheKey, workspaceUsers);
            return workspaceUsers;

        } catch (error: any) {
            console.error(`Failed to fetch workspace users for ${companyId}/${workspaceId}:`, error?.message || error);
            this.userCache.set(cacheKey, []);
            return [];
        }
    }

    /**
     * Fetch all tasks for a project and cache them
     */
    static async fetchProjectTasks(projectId: string): Promise<any[]> {
        if (this.taskCache.has(projectId)) {
            return this.taskCache.get(projectId)!;
        }

        try {
            const q = query(collection(db, 'tasks'), where('projectId', '==', projectId));
            const snapshot = await getDocs(q);
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            this.taskCache.set(projectId, tasks);
            return tasks;
        } catch (error: any) {
            console.error(`Failed to fetch tasks for project ${projectId}:`, error?.message || error);
            this.taskCache.set(projectId, []);
            return [];
        }
    }

    /**
     * Fetch all departments for a company and cache them
     */
    static async fetchDepartments(companyId: string): Promise<OrgUnit[]> {
        if (this.deptCache.has(companyId)) {
            return this.deptCache.get(companyId)!;
        }

        try {
            const q = query(collection(db, 'companies', companyId, 'orgUnits'));
            const snapshot = await getDocs(q);
            const depts = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as OrgUnit))
                .filter(d => d.status !== 'inactive');

            this.deptCache.set(companyId, depts);
            return depts;
        } catch (error: any) {
            console.error(`Failed to fetch departments for company ${companyId}:`, error?.message || error);
            this.deptCache.set(companyId, []);
            return [];
        }
    }

    /**
     * Fetch all teams for a company and cache them
     */
    static async fetchTeams(companyId: string): Promise<any[]> {
        if (this.teamCache.has(companyId)) {
            return this.teamCache.get(companyId)!;
        }

        try {
            const users = await this.fetchUsers(companyId);
            const teamNames = new Set<string>();

            users.forEach(u => {
                const teams = (u as any).spocTeams;
                if (teams && Array.isArray(teams)) {
                    teams.forEach((t: any) => {
                        if (typeof t === 'string' && t.trim()) {
                            teamNames.add(t.trim());
                        }
                    });
                }
            });

            const teams = Array.from(teamNames).sort().map(name => ({
                id: name,
                name: name
            }));

            this.teamCache.set(companyId, teams);
            return teams;
        } catch (error: any) {
            console.error(`Failed to aggregate teams for company ${companyId}:`, error?.message || error);
            this.teamCache.set(companyId, []);
            return [];
        }
    }

    /**
     * Fetch all projects for a company and cache them
     */
    static async fetchProjects(companyId: string): Promise<any[]> {
        if (this.projectCache.has(companyId)) {
            return this.projectCache.get(companyId)!;
        }

        try {
            const q = query(collection(db, 'companies', companyId, 'projects'));
            const snapshot = await getDocs(q);
            const projects = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter((p: any) => p.isDeleted !== true);

            this.projectCache.set(companyId, projects);
            return projects;
        } catch (error: any) {
            console.error(`Failed to fetch projects for company ${companyId}:`, error?.message || error);
            // Do not cache empty results on error to allow retries
            return [];
        }
    }

    /**
     * Fetch all projects for a specific workspace
     */
    static async fetchWorkspaceProjects(companyId: string, workspaceId: string): Promise<any[]> {
        const cacheKey = `ws:${companyId}:${workspaceId}`;

        // 1. Try specific cache first
        if (this.projectCache.has(cacheKey)) {
            return this.projectCache.get(cacheKey)!;
        }

        try {
            // 2. Fetch ALL projects (uses its own cache)
            const allProjects = await this.fetchProjects(companyId);

            // 3. Filter in memory for maximum robustness (avoids missing index issues)
            const workspaceProjects = allProjects.filter((p: any) => p.workspaceId === workspaceId);

            // 4. Cache and return
            this.projectCache.set(cacheKey, workspaceProjects);
            return workspaceProjects;
        } catch (error: any) {
            console.error(`Failed to fetch workspace projects for ws ${workspaceId}:`, error?.message || error);
            // Do not cache empty results on error
            return [];
        }
    }

    /**
     * Fetch all task types for a company
     */
    static async fetchTaskTypes(companyId: string): Promise<any[]> {
        if (this.taskTypeCache.has(companyId)) {
            return this.taskTypeCache.get(companyId)!;
        }

        try {
            const q = query(collection(db, 'companies', companyId, 'taskTypes'), where('isActive', '==', true));
            const snapshot = await getDocs(q);
            const types = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            this.taskTypeCache.set(companyId, types);
            return types;
        } catch (error: any) {
            console.error(`Failed to fetch task types for company ${companyId}:`, error?.message || error);
            this.taskTypeCache.set(companyId, []);
            return [];
        }
    }

    /**
     * Fetch all requirement types for a company
     */
    static async fetchRequirementTypes(companyId: string): Promise<any[]> {
        if (this.requirementTypeCache.has(companyId)) {
            return this.requirementTypeCache.get(companyId)!;
        }

        try {
            const q = query(collection(db, 'companies', companyId, 'requirementTypes'), where('isActive', '==', true));
            const snapshot = await getDocs(q);
            const types = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            this.requirementTypeCache.set(companyId, types);
            return types;
        } catch (error: any) {
            console.error(`Failed to fetch requirement types for company ${companyId}:`, error?.message || error);
            this.requirementTypeCache.set(companyId, []);
            return [];
        }
    }

    /**
     * Clear caches
     */
    static clearCache(companyId?: string, projectId?: string) {
        if (companyId) {
            this.userCache.delete(companyId);
            this.deptCache.delete(companyId);
            this.teamCache.delete(companyId);
            this.projectCache.delete(companyId);
            this.taskTypeCache.delete(companyId);
            this.requirementTypeCache.delete(companyId);
        } else if (projectId) {
            this.taskCache.delete(projectId);
        } else {
            this.userCache.clear();
            this.deptCache.clear();
            this.teamCache.clear();
            this.projectCache.clear();
            this.taskCache.clear();
            this.taskTypeCache.clear();
            this.requirementTypeCache.clear();
        }
    }

    /**
     * Helper to get last used companyId for ad-hoc resolutions
     */
    static getLastCompanyId(): string | null {
        return Array.from(this.userCache.keys())[0]?.split(':')[0] || null;
    }

    /**
     * Resolve a user by name or email (Workspace Scoped)
     */
    static async resolveWorkspaceUser(
        companyId: string,
        workspaceId: string,
        input: string
    ): Promise<ResolutionResult<string>> {
        if (!input) {
            return { success: true, resolved: false, confidence: 'none' };
        }

        let users: User[] = [];
        if (workspaceId && workspaceId.trim() !== '') {
            users = await this.fetchWorkspaceUsers(companyId, workspaceId);
        }

        if (users.length === 0) {
            return {
                success: false,
                resolved: false,
                confidence: 'none',
                error: `Workspace members not found.`
            };
        }

        const normalizedInput = input.toLowerCase().trim();

        const exactMatch = users.find(u =>
            u.email.toLowerCase() === normalizedInput ||
            u.name.toLowerCase() === normalizedInput
        );

        if (exactMatch) {
            return {
                success: true,
                resolved: true,
                value: exactMatch.id,
                label: exactMatch.name,
                confidence: 'exact'
            };
        }

        const partialMatches = users.filter(u =>
            u.name.toLowerCase().startsWith(normalizedInput) ||
            u.name.toLowerCase().includes(normalizedInput)
        );

        if (partialMatches.length === 1 && partialMatches[0]) {
            return {
                success: true,
                resolved: false,
                confidence: 'none',
                suggestions: [{
                    value: partialMatches[0].id,
                    label: partialMatches[0].name,
                    confidence: 0.95
                }]
            };
        }

        const userCandidates = users.map(u => ({ label: u.name, value: u.id }));
        const userMatches = SpellCheckService.findBestMatches(input, userCandidates);

        if (userMatches.length > 0) {
            return {
                success: true,
                resolved: false,
                confidence: 'none',
                suggestions: userMatches.map(m => ({
                    value: m.value,
                    label: m.label,
                    confidence: m.score
                }))
            };
        }

        return {
            success: false,
            resolved: false,
            confidence: 'none',
            error: `User "${input}" not found in this workspace`
        };
    }

    /**
     * Resolve a user by name or email (System Wide - Legacy fallback)
     */
    static async resolveUser(
        companyId: string,
        input: string
    ): Promise<ResolutionResult<string>> {
        if (!input) {
            return { success: true, resolved: false, confidence: 'none' };
        }

        const users = await this.fetchUsers(companyId);
        const normalizedInput = input.toLowerCase().trim();

        const exactMatch = users.find(u =>
            u.email.toLowerCase() === normalizedInput ||
            u.name.toLowerCase() === normalizedInput
        );

        if (exactMatch) {
            return {
                success: true,
                resolved: true,
                value: exactMatch.id,
                label: exactMatch.name,
                confidence: 'exact'
            };
        }

        const userCandidates = users.map(u => ({ label: u.name, value: u.id }));
        const userMatches = SpellCheckService.findBestMatches(input, userCandidates);

        if (userMatches.length > 0) {
            return {
                success: true,
                resolved: false,
                confidence: 'none',
                suggestions: userMatches.map(m => ({
                    value: m.value,
                    label: m.label,
                    confidence: m.score
                }))
            };
        }

        return {
            success: false,
            resolved: false,
            confidence: 'none',
            error: `User "${input}" not found`
        };
    }

    /**
     * Resolve a task by title (within current project or current batch)
     */
    static async resolveTask(
        projectId: string,
        input: string,
        batchTasks?: string[]
    ): Promise<ResolutionResult<string>> {
        if (!input) {
            return { success: true, resolved: false, confidence: 'none' };
        }

        const normalizedInput = input.toLowerCase().trim();

        if (batchTasks) {
            const batchMatch = batchTasks.find(t => t.toLowerCase().trim() === normalizedInput);
            if (batchMatch) {
                return {
                    success: true,
                    resolved: true,
                    value: `batch-${batchMatch}`,
                    label: batchMatch,
                    confidence: 'exact'
                };
            }
        }

        const tasks = await this.fetchProjectTasks(projectId);
        const exactMatch = tasks.find(t => (t.title || '').toLowerCase().trim() === normalizedInput);

        if (exactMatch) {
            return {
                success: true,
                resolved: true,
                value: exactMatch.id,
                label: exactMatch.title,
                confidence: 'exact'
            };
        }

        const taskCandidates = tasks.map(t => ({ label: t.title, value: t.id }));
        if (batchTasks) {
            taskCandidates.push(...batchTasks.map(t => ({ label: t, value: `batch-${t}` })));
        }

        const taskMatches = SpellCheckService.findBestMatches(input, taskCandidates);
        if (taskMatches.length > 0) {
            return {
                success: true,
                resolved: false,
                confidence: 'none',
                suggestions: taskMatches.map(m => ({
                    value: m.value,
                    label: m.label,
                    confidence: m.score
                }))
            };
        }

        return {
            success: false,
            resolved: false,
            confidence: 'none',
            error: `Task "${input}" not found`
        };
    }

    /**
     * Resolve a department by name
     */
    static async resolveDepartment(
        companyId: string,
        input: string
    ): Promise<ResolutionResult<string>> {
        if (!input) {
            return { success: true, resolved: false, confidence: 'none' };
        }

        const depts = await this.fetchDepartments(companyId);
        const normalizedInput = input.toLowerCase().trim();

        const exactMatch = depts.find(d => d.name.toLowerCase() === normalizedInput);
        if (exactMatch) {
            return {
                success: true,
                resolved: true,
                value: exactMatch.id,
                label: exactMatch.name,
                confidence: 'exact'
            };
        }

        const deptCandidates = depts.map(d => ({ label: d.name, value: d.id }));
        const deptMatches = SpellCheckService.findBestMatches(input, deptCandidates);

        if (deptMatches.length > 0) {
            return {
                success: true,
                resolved: false,
                confidence: 'none',
                suggestions: deptMatches.map(m => ({
                    value: m.value,
                    label: m.label,
                    confidence: m.score
                }))
            };
        }

        return {
            success: false,
            resolved: false,
            confidence: 'none',
            error: `Department "${input}" not found`
        };
    }

    /**
     * Resolve a project by name or code (System wide)
     */
    static async resolveProject(
        companyId: string,
        input: string
    ): Promise<ResolutionResult<string>> {
        if (!input) {
            return { success: true, resolved: false, confidence: 'none' };
        }

        const projects = await this.fetchProjects(companyId);
        const normalizedInput = input.toLowerCase().trim();

        const exactMatch = projects.find(p =>
            (p.name || '').toLowerCase().trim() === normalizedInput ||
            (p.projectCode || '').toLowerCase().trim() === normalizedInput
        );

        if (exactMatch) {
            return {
                success: true,
                resolved: true,
                value: exactMatch.id,
                label: exactMatch.name,
                confidence: 'exact'
            };
        }

        const projectCandidates = projects.map(p => ({ label: p.name, value: p.id }));
        const projectMatches = SpellCheckService.findBestMatches(input, projectCandidates);

        if (projectMatches.length > 0) {
            return {
                success: true,
                resolved: false,
                confidence: 'none',
                suggestions: projectMatches.map(m => ({
                    value: m.value,
                    label: m.label,
                    confidence: m.score
                }))
            };
        }

        return {
            success: false,
            resolved: false,
            confidence: 'none',
            error: `Project "${input}" not found`
        };
    }

    /**
     * Resolve a project by name (Workspace Scoped)
     */
    static async resolveWorkspaceProject(
        companyId: string,
        workspaceId: string,
        input: string
    ): Promise<ResolutionResult<string>> {
        if (!input) return { success: true, resolved: false, confidence: 'none' };

        const projects = await this.fetchWorkspaceProjects(companyId, workspaceId);
        const normalizedInput = input.toLowerCase().trim();

        const exactMatch = projects.find(p => (p.name || '').toLowerCase() === normalizedInput);
        if (exactMatch) {
            return {
                success: true,
                resolved: true,
                value: exactMatch.id,
                label: exactMatch.name,
                confidence: 'exact'
            };
        }

        const candidates = projects.map(p => ({ label: p.name, value: p.id }));
        const matches = SpellCheckService.findBestMatches(input, candidates);

        if (matches.length > 0) {
            return {
                success: true,
                resolved: false,
                confidence: 'none',
                suggestions: matches.map(m => ({
                    value: m.value,
                    label: m.label,
                    confidence: m.score
                }))
            };
        }

        return {
            success: false,
            resolved: false,
            confidence: 'none',
            error: `Project "${input}" not found in this workspace`
        };
    }

    /**
     * Resolve a team by name
     */
    static async resolveTeam(
        companyId: string,
        input: string
    ): Promise<ResolutionResult<string>> {
        if (!input) {
            return { success: true, resolved: false, confidence: 'none' };
        }

        const teams = await this.fetchTeams(companyId);
        const normalizedInput = input.toLowerCase().trim();

        const exactMatch = teams.find(t => (t.name || '').toLowerCase() === normalizedInput);
        if (exactMatch) {
            return {
                success: true,
                resolved: true,
                value: exactMatch.id,
                label: exactMatch.name,
                confidence: 'exact'
            };
        }

        const teamCandidates = teams.map(t => ({ label: t.name, value: t.id }));
        const teamMatches = SpellCheckService.findBestMatches(input, teamCandidates);

        if (teamMatches.length > 0) {
            return {
                success: true,
                resolved: false,
                confidence: 'none',
                suggestions: teamMatches.map(m => ({
                    value: m.value,
                    label: m.label,
                    confidence: m.score
                }))
            };
        }

        return {
            success: false,
            resolved: false,
            confidence: 'none',
            error: `Team "${input}" not found`
        };
    }

    /**
     * Resolve a task type by name
     */
    static async resolveTaskType(
        companyId: string,
        input: string
    ): Promise<ResolutionResult<string>> {
        if (!input) {
            return { success: true, resolved: false, confidence: 'none' };
        }

        const normalizedInput = input.toLowerCase().trim();

        // Default task types that are always valid (matching TaskForm defaults)
        const DEFAULT_TASK_TYPES = [
            'operations', 'compliance', 'maintenance', 'training',
            'project', 'safety', 'quality', 'other'
        ];

        // Check if input matches a default task type
        if (DEFAULT_TASK_TYPES.includes(normalizedInput)) {
            return {
                success: true,
                resolved: true,
                value: input, // Use the input value as-is for default types
                label: input,
                confidence: 'exact'
            };
        }

        const types = await this.fetchTaskTypes(companyId);

        const exactMatch = types.find(t => (t.name || '').toLowerCase() === normalizedInput);
        if (exactMatch) {
            return {
                success: true,
                resolved: true,
                value: exactMatch.id,
                label: exactMatch.name,
                confidence: 'exact'
            };
        }

        const candidates = types.map(t => ({ label: t.name, value: t.id }));
        const matches = SpellCheckService.findBestMatches(input, candidates);

        if (matches.length > 0) {
            return {
                success: true,
                resolved: false,
                confidence: 'none',
                suggestions: matches.map(m => ({
                    value: m.value,
                    label: m.label,
                    confidence: m.score
                }))
            };
        }

        return {
            success: false,
            resolved: false,
            confidence: 'none',
            error: `Task Type "${input}" not found`
        };
    }

    /**
     * Resolve a requirement type by name
     */
    static async resolveRequirementType(
        companyId: string,
        input: string
    ): Promise<ResolutionResult<string>> {
        if (!input) {
            return { success: true, resolved: false, confidence: 'none' };
        }

        const normalizedInput = input.toLowerCase().trim();

        // Default requirement types that are always valid (matching VirtualImportReviewTable defaults)
        const DEFAULT_REQUIREMENT_TYPES = [
            'regulatory', 'internal', 'customer', 'audit',
            'safety', 'quality', 'other'
        ];

        // Check if input matches a default requirement type
        if (DEFAULT_REQUIREMENT_TYPES.includes(normalizedInput)) {
            return {
                success: true,
                resolved: true,
                value: input, // Use the input value as-is for default types
                label: input,
                confidence: 'exact'
            };
        }

        const types = await this.fetchRequirementTypes(companyId);

        const exactMatch = types.find(t => (t.name || '').toLowerCase() === normalizedInput);
        if (exactMatch) {
            return {
                success: true,
                resolved: true,
                value: exactMatch.id,
                label: exactMatch.name,
                confidence: 'exact'
            };
        }

        const candidates = types.map(t => ({ label: t.name, value: t.id }));
        const matches = SpellCheckService.findBestMatches(input, candidates);

        if (matches.length > 0) {
            return {
                success: true,
                resolved: false,
                confidence: 'none',
                suggestions: matches.map(m => ({
                    value: m.value,
                    label: m.label,
                    confidence: m.score
                }))
            };
        }

        return {
            success: false,
            resolved: false,
            confidence: 'none',
            error: `Requirement Type "${input}" not found`
        };
    }

    /**
     * Fetch all positions for a company
     */
    static async fetchPositions(companyId: string): Promise<any[]> {
        if (this.positionCache.has(companyId)) {
            return this.positionCache.get(companyId)!;
        }

        try {
            const q = query(collection(db, 'companies', companyId, 'positions'), where('status', '==', 'active'));
            const snapshot = await getDocs(q);
            const positions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            this.positionCache.set(companyId, positions);
            return positions;
        } catch (error: any) {
            console.error(`Failed to fetch positions for company ${companyId}:`, error?.message || error);
            this.positionCache.set(companyId, []);
            return [];
        }
    }

    /**
     * Resolve a position by title or code
     */
    static async resolvePosition(
        companyId: string,
        input: string
    ): Promise<ResolutionResult<string>> {
        if (!input) {
            return { success: true, resolved: false, confidence: 'none' };
        }

        const positions = await this.fetchPositions(companyId);
        const normalizedInput = input.toLowerCase().trim();

        const exactTitle = positions.find(p => (p.title || '').toLowerCase() === normalizedInput);
        if (exactTitle) {
            return {
                success: true,
                resolved: true,
                value: exactTitle.id,
                label: exactTitle.title,
                confidence: 'exact'
            };
        }

        const exactCode = positions.find(p => (p.code || '').toLowerCase() === normalizedInput);
        if (exactCode) {
            return {
                success: true,
                resolved: true,
                value: exactCode.id,
                label: exactCode.title,
                confidence: 'exact'
            };
        }

        const candidates = positions.map(p => ({ label: p.title, value: p.id }));
        const matches = SpellCheckService.findBestMatches(input, candidates);

        if (matches.length > 0) {
            return {
                success: true,
                resolved: false,
                confidence: 'none',
                suggestions: matches.map(m => ({
                    value: m.value,
                    label: m.label,
                    confidence: m.score
                }))
            };
        }

        return {
            success: false,
            resolved: false,
            confidence: 'none',
            error: `Position "${input}" not found`
        };
    }
}
