import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { GeneratedTask } from '@/types/task-template-schema'
import { companySubcollectionPathSegments } from '@/lib/firestore-paths'

/**
 * Subscribe to real-time updates for a specific task
 */
export function subscribeToTask(
    companyId: string,
    taskId: string,
    onUpdate: (task: GeneratedTask) => void,
    onError?: (error: Error) => void,
    groupId?: string
): Unsubscribe {
    const segments = companySubcollectionPathSegments(groupId || companyId, companyId, 'tasks')
    const fullPath = [...segments, taskId]
    const taskRef = doc(db, fullPath[0], ...fullPath.slice(1))

    return onSnapshot(
        taskRef,
        (snapshot) => {
            if (snapshot.exists()) {
                const taskData = {
                    id: snapshot.id,
                    ...(snapshot.data() as any)
                } as GeneratedTask
                onUpdate(taskData)
            }
        },
        (error) => {
            console.error('[TaskRealtimeService] Error in task subscription:', error)
            if (onError) {
                onError(error)
            }
        }
    )
}
