'use client'

import React from 'react'
import { Bot, User } from 'lucide-react'
import { AgentToolResult } from './AgentToolResult'
import ReactMarkdown from 'react-markdown'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: Array<{
    id: string
    function: {
      name: string
      arguments: string
    }
  }>
  toolResults?: Array<{
    toolCallId: string
    result: any
  }>
}

export function AgentMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'}`}>
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>
      
      <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm ${isUser ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-gray-200 shadow-sm rounded-tl-none'}`}>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>

        {/* Render Tool Results if available (usually for assistant messages) */}
        {!isUser && message.toolResults?.map((toolResult) => (
           // Find corresponding tool call name if possible, or pass generic
           <AgentToolResult key={toolResult.toolCallId} toolName="Tool Result" result={toolResult.result} />
        ))}
      </div>
    </div>
  )
}
