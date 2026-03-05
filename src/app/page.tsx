'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '../store/authStore'

export default function HomePage() {
  const { user, loading } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (user.mustChangePassword) {
          router.push('/profile')
        } else {
          router.push('/my-tasks')
        }
      } else {
        router.push('/login')
      }
    }
  }, [user, loading, router])

  if (loading) {
    return null
  }

  return null
}
