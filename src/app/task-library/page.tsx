'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TaskTemplateManagement } from '@/components/templates/TaskTemplateManagement'
import { PositionTaskAssignmentManagement } from '@/components/features/org'
import { TaskMasterDataManagement } from '@/components/features/tasks/TaskMasterDataManagement'
import { 
  FileText, 
  Users, 
  CheckSquare, 
  Settings,
  BarChart3,
  TrendingUp,
  Clock,
  AlertCircle
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useCompany } from '@/hooks/useCompany'
import { TaskTemplateService } from '@/lib/services'
import { PositionTaskAssignmentService } from '@/lib/services'

export default function TaskLibraryPage() {
  const { currentCompany } = useCompany()
  const [stats, setStats] = useState({
    totalTemplates: 0,
    activeTemplates: 0,
    systemTemplates: 0,
    userTemplates: 0,
    totalAssignments: 0,
    completedTasks: 0,
    overdueTasks: 0,
    averageCompletionTime: 0,
    mostUsedTemplates: [] as Array<{
      templateId: string
      templateName: string
      usageCount: number
    }>
  })
  const [loading, setLoading] = useState(true)


  useEffect(() => {
    if (currentCompany?.id) {
      loadStats()
    }
  }, [currentCompany])

  async function loadStats() {
    if (!currentCompany?.id) return

    try {
      setLoading(true)
      const taskStats = await TaskTemplateService.getTaskLibraryStats(currentCompany.id)
      // Ensure all properties are defined
      setStats({
        totalTemplates: taskStats?.totalTemplates ?? 0,
        activeTemplates: taskStats?.activeTemplates ?? 0,
        systemTemplates: taskStats?.systemTemplates ?? 0,
        userTemplates: taskStats?.userTemplates ?? 0,
        totalAssignments: taskStats?.totalAssignments ?? 0,
        completedTasks: taskStats?.completedTasks ?? 0,
        overdueTasks: taskStats?.overdueTasks ?? 0,
        averageCompletionTime: taskStats?.averageCompletionTime ?? 0,
        mostUsedTemplates: Array.isArray(taskStats?.mostUsedTemplates) ? taskStats.mostUsedTemplates : [],
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
            <p className="text-gray-600 mt-2">
            Manage task templates, assign them to positions, and track task completion across your organization
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Templates</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalTemplates}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">{stats.activeTemplates}</p>
                </div>
                <Settings className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Assignments</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.totalAssignments}</p>
                </div>
                <Users className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{stats.completedTasks}</p>
                </div>
                <CheckSquare className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Overdue</p>
                  <p className="text-2xl font-bold text-red-600">{stats.overdueTasks}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Avg. Time</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.averageCompletionTime.toFixed(1)}h</p>
                </div>
                <Clock className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="master-data" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="master-data">Task Settings</TabsTrigger>
            <TabsTrigger value="templates">Task Templates</TabsTrigger>
            <TabsTrigger value="assignments">Position Assignments</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="master-data" className="space-y-6">
            <TaskMasterDataManagement />
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <TaskTemplateManagement />
          </TabsContent>

          <TabsContent value="assignments" className="space-y-6">
            <PositionTaskAssignmentManagement />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Template Usage Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Most Used Templates
                  </CardTitle>
                  <CardDescription>
                    Templates with the highest usage count
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.mostUsedTemplates?.slice(0, 5).map((template, index) => (
                      <div key={template.templateId} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600">
                            {index + 1}
                          </div>
                          <span className="text-sm font-medium">{template.templateName}</span>
                        </div>
                        <Badge variant="outline">{template.usageCount} uses</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Completion Rate Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Task Completion Rate
                  </CardTitle>
                  <CardDescription>
                    Overall task completion statistics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Completion Rate</span>
                      <span className="text-sm font-medium">
                        {stats.totalAssignments > 0 
                          ? ((stats.completedTasks / stats.totalAssignments) * 100).toFixed(1)
                          : 0
                        }%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ 
                          width: `${stats.totalAssignments > 0 
                            ? (stats.completedTasks / stats.totalAssignments) * 100 
                            : 0
                          }%` 
                        }}
                      ></div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{stats.completedTasks}</div>
                        <div className="text-sm text-gray-600">Completed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{stats.overdueTasks}</div>
                        <div className="text-sm text-gray-600">Overdue</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>
                    Common tasks for managing your task library
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                      <FileText className="h-6 w-6 mb-2" />
                      <span className="text-sm">Create Template</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                      <Users className="h-6 w-6 mb-2" />
                      <span className="text-sm">Assign to Position</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                      <CheckSquare className="h-6 w-6 mb-2" />
                      <span className="text-sm">View My Tasks</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                      <BarChart3 className="h-6 w-6 mb-2" />
                      <span className="text-sm">View Reports</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
