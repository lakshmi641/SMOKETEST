'use client'

import { useRouter } from 'next/navigation'
import { Lock, Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useCompany } from '@/contexts/CompanyContext'

interface ForbiddenContentProps {
  reason?: 'feature' | 'role' | 'permission'
  feature?: string | null
  attemptedPath?: string | null
}

export function ForbiddenContent({ 
  reason = 'feature', 
  feature = null, 
  attemptedPath = null 
}: ForbiddenContentProps) {
  const router = useRouter()
  const { currentCompany } = useCompany()

  const getTitle = () => {
    if (reason === 'feature') {
      return 'Feature Not Available'
    } else if (reason === 'permission') {
      return 'Access Denied'
    } else if (reason === 'role') {
      return 'Insufficient Permissions'
    }
    return 'Access Forbidden'
  }

  const getDescription = () => {
    if (reason === 'feature') {
      return feature 
        ? `The feature "${feature}" is not assigned to your organization. Please contact your administrator to enable this feature.`
        : 'This feature is not assigned to your organization. Please contact your administrator to enable this feature.'
    } else if (reason === 'permission') {
      return 'You do not have the required permissions to access this page.'
    } else if (reason === 'role') {
      return 'Your current role does not have access to this page.'
    }
    return 'You do not have permission to access this resource.'
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
            <Lock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {getTitle()}
          </CardTitle>
          <CardDescription className="text-base">
            {getDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {attemptedPath && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Attempted path:</span>{' '}
                <code className="text-xs bg-background px-1.5 py-0.5 rounded">
                  {attemptedPath}
                </code>
              </p>
            </div>
          )}

          {reason === 'feature' && currentCompany && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <span className="font-medium">Organization:</span> {currentCompany.name}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                To access this feature, please contact your administrator to enable it for your organization.
              </p>
            </div>
          )}

          <div className="flex flex-col space-y-2 pt-2">
            <Button
              onClick={() => router.push('/my-tasks')}
              className="w-full"
              variant="default"
            >
              <Home className="mr-2 h-4 w-4" />
              Go to My Tasks
            </Button>
            
            {attemptedPath && (
              <Button
                onClick={() => router.back()}
                className="w-full"
                variant="outline"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            )}
          </div>

          <div className="text-center pt-4">
            <p className="text-xs text-muted-foreground">
              Error Code: 403 Forbidden
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
