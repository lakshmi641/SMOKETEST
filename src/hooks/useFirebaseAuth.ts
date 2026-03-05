'use client'

import { useState, useEffect } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth } from '@/lib/firebase'

/**
 * Hook that provides Firebase auth state with proper initialization tracking.
 * This ensures we don't make Firestore queries before auth is ready.
 */
export function useFirebaseAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
      setInitialized(true)
    })

    return () => unsubscribe()
  }, [])

  return {
    user,
    loading,
    initialized,
    isAuthenticated: initialized && user !== null,
  }
}
