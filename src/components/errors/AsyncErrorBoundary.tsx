'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AsyncErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onRetry?: () => void
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface AsyncErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  isRetrying: boolean
}

export class AsyncErrorBoundary extends Component<AsyncErrorBoundaryProps, AsyncErrorBoundaryState> {
  constructor(props: AsyncErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isRetrying: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<AsyncErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Log async errors
    console.error('AsyncErrorBoundary caught an error:', error, errorInfo)
  }

  handleRetry = async () => {
    this.setState({ isRetrying: true })
    
    try {
      if (this.props.onRetry) {
        await this.props.onRetry()
      }
      
      // Reset error state
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        isRetrying: false
      })
    } catch (error) {
      console.error('Retry failed:', error)
      this.setState({ isRetrying: false })
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Operation Failed
            </CardTitle>
            <CardDescription className="text-gray-600">
              {this.state.error?.message || 'Something went wrong while processing your request.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="rounded-md bg-yellow-50 p-3">
                <h4 className="text-sm font-medium text-yellow-800 mb-1">Error Details:</h4>
                <p className="text-sm text-yellow-700 font-mono">
                  {this.state.error.message}
                </p>
              </div>
            )}
            
            <Button
              onClick={this.handleRetry}
              disabled={this.state.isRetrying}
              className="w-full"
              variant="default"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${this.state.isRetrying ? 'animate-spin' : ''}`} />
              {this.state.isRetrying ? 'Retrying...' : 'Try Again'}
            </Button>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

// Hook for handling async errors in functional components
export function useAsyncError() {
  const [, setError] = React.useState()
  
  return React.useCallback((error: Error) => {
    setError(() => {
      throw error
    })
  }, [])
}

// Utility function for wrapping async operations
export function withAsyncErrorHandling<T extends any[], R>(
  asyncFn: (...args: T) => Promise<R>,
  onError?: (error: Error) => void
) {
  return async (...args: T): Promise<R | null> => {
    try {
      return await asyncFn(...args)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      
      if (onError) {
        onError(err)
      } else {
        console.error('Async operation failed:', err)
      }
      
      return null
    }
  }
}
