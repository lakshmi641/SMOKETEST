'use client'

import { useSearchParams } from 'next/navigation'
import { ForbiddenContent } from '@/components/errors/ForbiddenContent'

export default function ForbiddenPage() {
  const searchParams = useSearchParams()
  
  // Get the reason from query params if available
  const reason = (searchParams.get('reason') as 'feature' | 'role' | 'permission') || 'feature'
  const feature = searchParams.get('feature') || null
  const attemptedPath = searchParams.get('path') || null

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <ForbiddenContent
        reason={reason}
        feature={feature}
        attemptedPath={attemptedPath}
      />
    </div>
  )
}
