'use client'

import { useState, useEffect } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { getFirestoreInstance } from '@/lib/firebase'
import { useFirebaseAuth } from './useFirebaseAuth'

/**
 * Hook to get the count of active workflow instances.
 * Used for displaying badge count in the sidebar navigation.
 */
export function useActiveInstanceCount() {
  const { companyId, groupId } = useCompany()
  const { isAuthenticated, initialized } = useFirebaseAuth()
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Wait for auth to be initialized and user to be authenticated
    if (!initialized) {
      return
    }

    if (!isAuthenticated || !companyId) {
      setCount(0)
      setLoading(false)
      return
    }

    setLoading(true)

    // Query for active workflow instances
    const db = getFirestoreInstance()
    // Import helper dynamically or assume it's imported at top (it's not, need to add import)
    // Adding import via separate edit or using manual path construction if safer?
    // Let's use the helper. Note: need to add import at top of file.

    const pathSegments = groupId
      ? [`enterpriseGroups/${groupId}/companies/${companyId}/workflowInstances`]
      : [`companies/${companyId}/workflowInstances`]

    const q = query(
      collection(db, pathSegments[0]!),
      where('status', 'in', ['pending', 'in_progress'])
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCount(snapshot.size)
        setLoading(false)
      },
      (error) => {
        // Silently handle Firestore errors
        console.warn('Instance count listener error:', error.message)
        setCount(0)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [companyId, isAuthenticated, initialized])

  return { count, loading }
}
