'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCompany } from '@/contexts/CompanyContext'
import { TaskTemplateService } from '@/lib/services'

/**
 * Redirect page: /tasks/{id} → /projects/{projectId}/tasks/{id}
 * This ensures old bookmarks/links still work
 */
export default function TaskRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const { currentCompany } = useCompany()
  const [error, setError] = useState(false)
  const taskId = params.id as string

  useEffect(() => {
    const redirectToProject = async () => {
      if (!currentCompany?.id || !taskId) {
        setError(true)
        return
      }

      try {
        // Find the task to get its projectId
        const tasks = await TaskTemplateService.getUserTasks(currentCompany.id, '')
        const task = tasks.find(t => t.id === taskId)
        
        if (task && task.projectId) {
          // Redirect to the new project-based URL
          router.replace(`/projects/${task.projectId}/tasks/${taskId}`)
        } else {
          // Task not found or no projectId - go to my tasks
          setError(true)
          setTimeout(() => router.push('/my-tasks'), 2000)
        }
      } catch (err) {
        console.error('Error finding task:', err)
        setError(true)
        setTimeout(() => router.push('/my-tasks'), 2000)
      }
    }

    redirectToProject()
  }, [currentCompany?.id, taskId, router])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Task Not Found</h2>
          <p className="text-gray-600 mb-4">Redirecting to My Tasks...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to task...</p>
      </div>
    </div>
  )
}
