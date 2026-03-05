'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRouter } from 'next/navigation'

interface ProjectTabsProps {
  projectId: string
  active: 'summary' | 'timeline' | 'board' | 'list' | 'calendar'
}

export function ProjectTabs({ projectId, active }: ProjectTabsProps) {
  const router = useRouter()

  const go = (tab: ProjectTabsProps['active']) => {
    switch (tab) {
      case 'summary':
        router.push(`/projects/${projectId}`)
        break
      case 'timeline':
        router.push(`/projects/${projectId}/timeline`)
        break
      case 'board':
        router.push(`/projects/${projectId}/board`)
        break
      case 'list':
        router.push(`/projects/${projectId}/list`)
        break
      case 'calendar':
        router.push(`/projects/${projectId}/calendar`)
        break
    }
  }

  return (
    <Tabs value={active} className="w-full">
      <TabsList className="border-b w-full justify-start bg-transparent h-auto p-0 rounded-none">
        <TabsTrigger
          value="summary"
          className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none"
          onClick={() => go('summary')}
        >
          Summary
        </TabsTrigger>
        <TabsTrigger
          value="timeline"
          className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none"
          onClick={() => go('timeline')}
        >
          Timeline
        </TabsTrigger>
        <TabsTrigger
          value="board"
          className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none"
          onClick={() => go('board')}
        >
          Board
        </TabsTrigger>
        <TabsTrigger
          value="list"
          className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none"
          onClick={() => go('list')}
        >
          List
        </TabsTrigger>
        <TabsTrigger
          value="calendar"
          className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none"
          onClick={() => go('calendar')}
        >
          Calendar
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}



