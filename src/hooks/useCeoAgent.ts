/**
 * useCeoAgent Hook
 * Direct AG-UI SSE streaming implementation for CEO Visibility Agent
 */

import React, { useCallback, useRef, useState } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { auth } from '@/lib/firebase'

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  toolCalls?: Array<{
    id: string
    name: string
    arguments: Record<string, any>
  }>
  toolResults?: Array<{
    toolName: string
    result: Record<string, any>
  }>
}

interface UseCeoAgentOptions {
  autoStart?: boolean
}

export function useCeoAgent(options: UseCeoAgentOptions = {}) {
  const { companyId } = useCompany()
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Get Firebase token for authentication
  const getAuthHeaders = useCallback(async () => {
    try {
      const user = auth.currentUser

      if (!user) {
        throw new Error('User not authenticated')
      }

      if (!companyId) {
        throw new Error('Company ID not found')
      }

      const token = await user.getIdToken()

      return {
        'Authorization': `Bearer ${token}`,
        'X-Company-Id': companyId,
        'Content-Type': 'application/json',
      } as Record<string, string>
    } catch (err) {
      console.error('Failed to get auth headers:', err)
      throw err
    }
  }, [companyId])

  // Send message and stream response
  const append = useCallback(
    async (message: { role: 'user' | 'assistant'; content: string }) => {
      if (!message.content.trim()) {
        setError('Message cannot be empty')
        return
      }

      try {
        setError(null)
        setIsLoading(true)

        // Add user message to history
        const userMessage: AgentMessage = {
          id: Date.now().toString(),
          role: 'user',
          content: message.content,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, userMessage])

        // Get auth headers
        const headers = await getAuthHeaders()

        // Create abort controller for this request
        abortControllerRef.current = new AbortController()

        // Call AG-UI endpoint
        const agentUrl = process.env.NEXT_PUBLIC_CEO_AGENT_URL || 'http://localhost:8080'
        const response = await fetch(`${agentUrl}/agui`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            userMessage: message.content,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`Agent request failed: ${response.statusText}`)
        }

        if (!response.body) {
          throw new Error('No response body')
        }

        // Process SSE stream
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let assistantMessageId = (Date.now() + 1).toString()
        let assistantContent = ''

        const assistantMessage: AgentMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: assistantContent,
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, assistantMessage])

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n').filter((line) => line.trim())

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6)
                const data = JSON.parse(jsonStr)

                if (data.type === 'text') {
                  assistantContent += data.content
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, content: assistantContent }
                        : m
                    )
                  )
                } else if (data.type === 'tool_call') {
                  // Handle tool calls
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId
                        ? {
                            ...m,
                            toolCalls: [
                              ...(m.toolCalls || []),
                              {
                                id: data.id,
                                name: data.tool_name,
                                arguments: data.tool_args,
                              },
                            ],
                          }
                        : m
                    )
                  )
                } else if (data.type === 'tool_result') {
                  // Handle tool results
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId
                        ? {
                            ...m,
                            toolResults: [
                              ...(m.toolResults || []),
                              {
                                toolName: data.tool_name,
                                result: data.result,
                              },
                            ],
                          }
                        : m
                    )
                  )
                }
              } catch (parseError) {
                console.error('Failed to parse SSE data:', parseError)
              }
            }
          }
        }

        setIsLoading(false)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('Message streaming aborted')
        } else {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error'
          setError(errorMessage)
          console.error('Failed to stream message:', err)
        }
        setIsLoading(false)
      }
    },
    [messages, getAuthHeaders]
  )

  // Cancel current streaming
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
    }
  }, [])

  // Clear messages
  const clear = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    isLoading,
    error,
    append,
    abort,
    clear,
  }
}
