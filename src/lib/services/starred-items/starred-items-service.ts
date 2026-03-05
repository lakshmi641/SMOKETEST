import { db } from '@/lib/firebase'
import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    query,
    where,
    getDocs
} from 'firebase/firestore'
import { companyCollectionPathSegments } from '@/lib/firestore-paths'
import type { StarredItem, StarredItemsMap } from '@/types/starred-items'

export class StarredItemsService {
    /**
     * Toggle starred status for an entity (enterprise path)
     */
    static async toggleStarred(
        groupId: string,
        companyId: string,
        userId: string,
        entityType: 'task' | 'project' | 'workspace',
        entityId: string
    ): Promise<boolean> {
        const pathSegments = companyCollectionPathSegments(groupId, companyId, 'starred_items')
        const starredItemsRef = collection(db, ...(pathSegments as [string, ...string[]]))

        // Check if already starred
        const q = query(
            starredItemsRef,
            where('userId', '==', userId),
            where('entityType', '==', entityType),
            where('entityId', '==', entityId)
        )

        const snapshot = await getDocs(q)

        if (!snapshot.empty) {
            // Already starred - remove it
            const docId = snapshot.docs[0]?.id
            if (docId) {
                await deleteDoc(doc(starredItemsRef, docId))
            }
            return false
        } else {
            // Not starred - add it
            const newDocRef = doc(starredItemsRef)
            const now = new Date().toISOString()

            await setDoc(newDocRef, {
                id: newDocRef.id,
                userId,
                entityType,
                entityId,
                starredAt: now,
                createdAt: now,
                updatedAt: now
            })
            return true
        }
    }

    /**
     * Get all starred items for a user
     */
    static async getUserStarredItems(
        groupId: string,
        companyId: string,
        userId: string
    ): Promise<StarredItemsMap> {
        if (!groupId || !companyId || !userId) {
            return { tasks: new Set(), projects: new Set(), workspaces: new Set() }
        }
        const pathSegments = companyCollectionPathSegments(groupId, companyId, 'starred_items')
        const starredItemsRef = collection(db, ...(pathSegments as [string, ...string[]]))
        const q = query(starredItemsRef, where('userId', '==', userId))

        const snapshot = await getDocs(q)

        const starredMap: StarredItemsMap = {
            tasks: new Set(),
            projects: new Set(),
            workspaces: new Set()
        }

        snapshot.docs.forEach(doc => {
            const data = doc.data() as StarredItem
            const key = `${data.entityType}s` as keyof StarredItemsMap
            if (starredMap[key]) {
                starredMap[key].add(data.entityId)
            }
        })

        return starredMap
    }

    /**
     * Check if a specific entity is starred
     */
    static async isStarred(
        groupId: string,
        companyId: string,
        userId: string,
        entityType: 'task' | 'project' | 'workspace',
        entityId: string
    ): Promise<boolean> {
        const pathSegments = companyCollectionPathSegments(groupId, companyId, 'starred_items')
        const starredItemsRef = collection(db, ...(pathSegments as [string, ...string[]]))
        const q = query(
            starredItemsRef,
            where('userId', '==', userId),
            where('entityType', '==', entityType),
            where('entityId', '==', entityId)
        )

        const snapshot = await getDocs(q)
        return !snapshot.empty
    }

    /**
     * Remove all starred items for a deleted entity (cleanup)
     */
    static async removeStarredEntity(
        groupId: string,
        companyId: string,
        entityType: 'task' | 'project' | 'workspace',
        entityId: string
    ): Promise<void> {
        const pathSegments = companyCollectionPathSegments(groupId, companyId, 'starred_items')
        const starredItemsRef = collection(db, ...(pathSegments as [string, ...string[]]))
        const q = query(
            starredItemsRef,
            where('entityType', '==', entityType),
            where('entityId', '==', entityId)
        )

        const snapshot = await getDocs(q)
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref))
        await Promise.all(deletePromises)
    }
}
