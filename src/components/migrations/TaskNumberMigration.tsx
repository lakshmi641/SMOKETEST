'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getFirestoreInstance } from '@/lib/firebase'
import { collection, getDocs, writeBatch, query, where, updateDoc } from 'firebase/firestore'
import toast from 'react-hot-toast'

// Helper to generate short key: "Demo Project" -> "DP", "Industrial" -> "IND"
function generateSmartKey(name: string): string {
    if (!name) return 'PRJ'
    // Clean and upper
    const clean = name.replace(/[^a-zA-Z0-9 ]/g, '').toUpperCase()
    const words = clean.split(' ').filter(w => w.length > 0)

    if (words.length === 0) return 'PRJ'

    // Single word: "Demo" -> "DE"
    if (words.length === 1) {
        const w = words[0] || 'PRJ'
        return w.length < 3 ? w : w.substring(0, 3)
    }

    // Multi word
    let code = ''
    for (const w of words) {
        code += w[0]
        if (code.length >= 3) break
    }
    return code
}

export function TaskNumberMigration() {
    const { user } = useAuthStore()

    // v7: Admin-only Silent Migration
    useEffect(() => {
        if (!user || !user.companyId) return

        // --- BEST PRACTICE CHECK: Only Admins/Managers should run migrations ---
        const privilegedRoles = ['admin', 'owner', 'manager', 'Admin', 'Owner', 'Manager'];
        const userRole = user.role || 'employee';
        const isAdmin = privilegedRoles.includes(userRole);

        if (!isAdmin) {
            // Regular users should not attempt to write to project or bulk-write tasks
            return;
        }

        const checkAndMigrate = async () => {
            const MIGRATION_KEY = `task_seq_migration_v7_${user.companyId}`
            if (localStorage.getItem(MIGRATION_KEY)) return

            try {
                const companyId = user.companyId
                const db = getFirestoreInstance()
                const projectsRef = collection(db, `companies/${companyId}/projects`)
                const projectsSnap = await getDocs(projectsRef)

                // Only log in development or if explicitly needed
                if (process.env.NODE_ENV === 'development') {
                    console.log('[Migration] Checking for Project Key optimizations (v7)...')
                }

                let performedUpdates = false

                // 1. Scan existing Cleanup Codes
                const usedCodes = new Set<string>()
                projectsSnap.docs.forEach(d => {
                    const data = d.data()
                    const code = data.projectCode
                    if (code && /^[A-Z0-9]+$/.test(code)) {
                        usedCodes.add(code)
                    }
                })

                // 2. Iterate Projects via Docs
                for (const projectDoc of projectsSnap.docs) {
                    const projectId = projectDoc.id
                    const projectData = projectDoc.data()

                    const currentCode = projectData.projectCode
                    const isMessy = !currentCode || currentCode === 'TASK' || currentCode.includes('-')

                    if (isMessy) {
                        const baseKey = generateSmartKey(projectData.name)
                        let finalKey = baseKey
                        let counter = 1

                        while (usedCodes.has(finalKey)) {
                            finalKey = `${baseKey}${counter}`
                            counter++
                        }
                        usedCodes.add(finalKey)

                        if (process.env.NODE_ENV === 'development') {
                            console.log(`[Migration] Optimizing Key: ${currentCode} -> ${finalKey}`)
                        }
                        await updateDoc(projectDoc.ref, { projectCode: finalKey })
                        performedUpdates = true
                    }

                    // --- Task Number Backfill ---
                    const tasksRef = collection(db, `companies/${companyId}/tasks`)
                    const q = query(tasksRef, where('projectId', '==', projectId))
                    const tasksSnap = await getDocs(q)

                    if (!tasksSnap.empty) {
                        const tasks = tasksSnap.docs.map(d => ({ ref: d.ref, data: d.data() }))

                        tasks.sort((a, b) => {
                            const da = a.data.createdAt
                            const db = b.data.createdAt
                            const ta = da?.seconds ? da.seconds * 1000 : new Date(da || 0).getTime()
                            const tb = db?.seconds ? db.seconds * 1000 : new Date(db || 0).getTime()
                            return ta - tb
                        })

                        let counter = 0
                        const batch = writeBatch(db)
                        let opCount = 0
                        let batchOpCount = 0

                        for (const task of tasks) {
                            const tData = task.data
                            if (tData.taskNumber) {
                                counter = Math.max(counter, tData.taskNumber)
                            } else {
                                counter++
                                batch.update(task.ref, { taskNumber: counter })
                                opCount++
                                batchOpCount++
                            }

                            if (batchOpCount >= 400) {
                                await batch.commit()
                                batchOpCount = 0
                            }
                        }

                        if (opCount > 0) {
                            await batch.commit()
                            if ((projectData.taskCounter || 0) < counter) {
                                await updateDoc(projectDoc.ref, { taskCounter: counter })
                            }
                            performedUpdates = true
                        }
                    }
                }

                if (performedUpdates) {
                    toast.success('Project metadata modernized.', { duration: 3000 })
                }

                localStorage.setItem(MIGRATION_KEY, 'true')

            } catch (error: any) {
                // Completely silent for permission-denied to avoid console clutter for normal users
                if (error.code !== 'permission-denied' && process.env.NODE_ENV === 'development') {
                    console.error('[Migration] Critical failure:', error)
                }
            }
        }

        checkAndMigrate()
    }, [user])

    return null
}
