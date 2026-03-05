import React from 'react'
import { MilestoneHealth } from '@/lib/services/dashboard/analytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface MilestoneBatteryProps {
  milestones: MilestoneHealth[]
}

export function MilestoneBattery({ milestones }: MilestoneBatteryProps) {
  const total = milestones.length

  if (total === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center text-center h-40">
            <p className="text-muted-foreground text-sm">No milestones found</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Group by status
  const counts = {
    completed: milestones.filter(m => m.status === 'completed').length,
    at_risk: milestones.filter(m => m.status === 'at_risk' || m.status === 'late').length,
    on_track: milestones.filter(m => m.status === 'on_track').length,
  }

  const percentages = {
    completed: (counts.completed / total) * 100,
    at_risk: (counts.at_risk / total) * 100,
    on_track: (counts.on_track / total) * 100,
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Milestone Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            <p className="text-2xl font-bold text-foreground">{total}</p>
            <p className="text-sm text-muted-foreground">Total Milestones</p>
          </div>
          <div className="flex-1 text-right">
            <p className="text-2xl font-bold text-foreground">{counts.at_risk}</p>
            <p className="text-sm text-muted-foreground">At Risk</p>
          </div>
        </div>

        {/* Battery Bar */}
        <div className="w-full flex overflow-hidden h-2 rounded-full bg-gray-200">
          {percentages.completed > 0 && (
            <div 
              style={{ width: `${percentages.completed}%` }} 
              className="bg-green-500 transition-all duration-500"
              role="progressbar"
              aria-label="Completed"
            />
          )}
          {percentages.on_track > 0 && (
            <div 
              style={{ width: `${percentages.on_track}%` }} 
              className="bg-blue-500 transition-all duration-500"
              role="progressbar"
              aria-label="On Track"
            />
          )}
          {percentages.at_risk > 0 && (
            <div 
              style={{ width: `${percentages.at_risk}%` }} 
              className="bg-red-500 transition-all duration-500"
              role="progressbar"
              aria-label="At Risk"
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex justify-between mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Done ({Math.round(percentages.completed)}%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Track ({Math.round(percentages.on_track)}%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>Risk ({Math.round(percentages.at_risk)}%)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

