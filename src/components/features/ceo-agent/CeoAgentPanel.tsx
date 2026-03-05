'use client'

import React, { useRef, useEffect } from 'react'
import { useCeoAgent } from '@/hooks/useCeoAgent'
import { AgentMessage } from './AgentMessage'
import { Send, Loader2, StopCircle } from 'lucide-react'

export function CeoAgentPanel() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, stop } = useCeoAgent()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-50">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">CEO Visibility Agent</h3>
            <p className="text-sm text-gray-500 max-w-xs mt-2">
              Ask about strategic health, portfolio risks, or search company knowledge.
            </p>
          </div>
        )}
        
        {messages.map((m) => (
          <AgentMessage key={m.id} message={m as any} />
        ))}
        
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-400 ml-12 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            Thinking...
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about portfolio health, risks, or company policies..."
            className="flex-1 py-3 px-4 bg-gray-100 border-transparent focus:bg-white focus:border-purple-500 focus:ring-0 rounded-xl text-sm transition-all"
            disabled={isLoading}
          />
          
          {isLoading ? (
            <button
              type="button"
              onClick={stop}
              className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
            >
              <StopCircle className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
