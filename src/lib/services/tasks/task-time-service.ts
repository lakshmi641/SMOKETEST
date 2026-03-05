import {
    collection,
    doc,
    getDocs,
    query,
    orderBy,
    runTransaction
} from 'firebase/firestore'
import { db } from '../../firebase'
import type { TaskTimeEntry } from '@/types/task-time-schema'

export class TaskTimeService {
    /**
     * Log time and update task's actualHours
     */
    static async logTime(
        companyId: string,
        entry: Omit<TaskTimeEntry, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<void> {
        const taskRef = doc(db, 'companies', companyId, 'tasks', entry.taskId)
        const timeEntriesRef = collection(db, 'companies', companyId, 'tasks', entry.taskId, 'timeEntries')

        await runTransaction(db, async (transaction) => {
            const taskSnap = await transaction.get(taskRef)
            if (!taskSnap.exists()) {
                throw new Error('Task not found')
            }

            const taskData = taskSnap.data()
            const currentHours = taskData.actualHours || 0
            const newTotalHours = currentHours + entry.duration

            // 1. Create the time entry
            const now = new Date().toISOString()
            const newEntryRef = doc(timeEntriesRef)
            transaction.set(newEntryRef, {
                ...entry,
                createdAt: now,
                updatedAt: now,
            })

            // 2. Update task total hours
            transaction.update(taskRef, {
                actualHours: newTotalHours,
                updatedAt: now,
            })
        })
    }

    /**
     * Get all time entries for a task
     */
    static async getTimeEntries(companyId: string, taskId: string): Promise<TaskTimeEntry[]> {
        const ref = collection(db, 'companies', companyId, 'tasks', taskId, 'timeEntries')
        const q = query(ref, orderBy('date', 'desc'), orderBy('createdAt', 'desc'))
        const snap = await getDocs(q)
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as TaskTimeEntry))
    }

    /**
     * Delete a time entry and update task's actualHours
     */
    static async deleteTimeEntry(
        companyId: string,
        taskId: string,
        entryId: string
    ): Promise<void> {
        const taskRef = doc(db, 'companies', companyId, 'tasks', taskId)
        const entryRef = doc(db, 'companies', companyId, 'tasks', taskId, 'timeEntries', entryId)

        await runTransaction(db, async (transaction) => {
            const taskSnap = await transaction.get(taskRef)
            const entrySnap = await transaction.get(entryRef)

            if (!taskSnap.exists()) throw new Error('Task not found')
            if (!entrySnap.exists()) throw new Error('Entry not found')

            const taskData = taskSnap.data()
            const entryData = entrySnap.data() as TaskTimeEntry

            const currentHours = taskData.actualHours || 0
            const newTotalHours = Math.max(0, currentHours - entryData.duration)

            // 1. Delete entry
            transaction.delete(entryRef)

            // 2. Update task
            transaction.update(taskRef, {
                actualHours: newTotalHours,
                updatedAt: new Date().toISOString()
            })
        })
    }
}
