'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProtectedPage } from '@/components/auth/ProtectedPage'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Loader2, BarChart3, TrendingUp, Users, Package, MapPin, Calendar, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Dashboard {
  id: number
  name: string
  description: string
  icon: string
}

const DASHBOARDS: Dashboard[] = [
  {
    id: 10, // Group Level Revenue Reports - Already exists in Metabase
    name: 'Group Level Revenue Reports',
    description: 'Aggregated revenue analytics across all companies',
    icon: 'building-2',
  },
  {
    id: 2, // Executive Sales Dashboard - Created in Metabase
    name: 'Executive Sales Dashboard',
    description: 'Revenue trends, growth rates, top customers and products',
    icon: 'trending-up',
  },
  {
    id: 3, // Customer Analytics - Created in Metabase
    name: 'Customer Analytics',
    description: 'Customer segmentation, lifetime value, and acquisition trends',
    icon: 'users',
  },
  {
    id: 5, // Regional Sales - Created in Metabase
    name: 'Regional Sales',
    description: 'Sales by region, regional growth, and market share',
    icon: 'map-pin',
  },
  {
    id: 6, // Sales Trends - Created in Metabase
    name: 'Sales Trends',
    description: 'Time series analysis, seasonal patterns, and forecasting',
    icon: 'calendar',
  },
  {
    id: 9, // Advanced Analytics - Created in Metabase
    name: 'Advanced Analytics',
    description: 'Customer concentration, market basket analysis, and price elasticity',
    icon: 'bar-chart-3',
  },
]

const getIcon = (iconName: string) => {
  switch (iconName) {
    case 'trending-up':
      return <TrendingUp className="h-5 w-5" />
    case 'users':
      return <Users className="h-5 w-5" />
    case 'package':
      return <Package className="h-5 w-5" />
    case 'map-pin':
      return <MapPin className="h-5 w-5" />
    case 'calendar':
      return <Calendar className="h-5 w-5" />
    case 'bar-chart-3':
      return <BarChart3 className="h-5 w-5" />
    case 'building-2':
      return <Building2 className="h-5 w-5" />
    default:
      return <BarChart3 className="h-5 w-5" />
  }
}

export default function AnalyticsPage() {
  // RouteGuard handles access control - this component only renders if access is granted
  // But we add an extra safety check to prevent execution if somehow component renders without access
  const { companyId, isLoading: companyLoading, currentCompany } = useCompany()
  const [selectedDashboard, setSelectedDashboard] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<string>(DASHBOARDS[0]?.id.toString() || '')
  const [embeddingUrl, setEmbeddingUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [iframeError, setIframeError] = useState(false)
  
  // Safety check: Verify feature is enabled before allowing any execution
  // This prevents API calls even if component somehow renders
  const hasFeature = useMemo(() => {
    if (!currentCompany?.features) return false
    return currentCompany.features.advancedReporting === true
  }, [currentCompany?.features])

  const loadDashboard = useCallback(async (dashboardId: number) => {
    // Safety check: Don't make API calls if feature is not enabled
    if (!hasFeature) {
      return
    }

    if (!companyId) {
      toast.error('Company ID is required. Please ensure you are logged in and have selected a company.')
      return
    }

    if (dashboardId === 0) {
      toast.error('This dashboard is not yet configured. Please create it in Metabase first.')
      return
    }

    try {
      setLoading(true)
      setEmbeddingUrl(null) // Clear previous dashboard
      setIframeError(false) // Reset error state
      
      const response = await fetch(
        `/api/metabase/embed?dashboardId=${dashboardId}`
      )
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()

      if (data.success && data.url) {
        setEmbeddingUrl(data.url)
        setSelectedDashboard(dashboardId)
      } else {
        const errorMessage = data.error || 'Failed to load dashboard'
        toast.error(errorMessage)
        console.error('Dashboard loading error:', errorMessage)
      }
    } catch (error) {
      console.error('Error loading dashboard:', error)
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to load dashboard. Please check Metabase configuration.'
      toast.error(errorMessage)
      setIframeError(true)
    } finally {
      setLoading(false)
    }
  }, [companyId, hasFeature])

  const selectedDashboardInfo = useMemo(() => {
    return DASHBOARDS.find((d) => d.id === selectedDashboard)
  }, [selectedDashboard])

  const handleIframeError = useCallback(() => {
    setIframeError(true)
    toast.error('Failed to load dashboard content. Please try again or contact support.')
  }, [])

  // Auto-load dashboard when tab changes or company is ready
  // RouteGuard ensures this component only renders if user has access
  // But we add an extra safety check here to prevent API calls if somehow component renders without access
  useEffect(() => {
    // Safety check: Don't make API calls if feature is not enabled
    if (!hasFeature) {
      return
    }

    // Safety check: Don't make API calls if company is still loading
    if (companyLoading) {
      return
    }

    // Safety check: Don't make API calls if no company ID
    if (!companyId) {
      return
    }

    if (activeTab) {
      const dashboardId = parseInt(activeTab, 10)
      if (!isNaN(dashboardId) && dashboardId > 0) {
        loadDashboard(dashboardId)
      }
    }
  }, [activeTab, companyId, companyLoading, loadDashboard, hasFeature])

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value)
    const dashboardId = parseInt(value, 10)
    if (!isNaN(dashboardId)) {
      setSelectedDashboard(dashboardId)
    }
  }, [])

  return (
    <DashboardLayout>
      <ProtectedPage>
        {() => (
          <div className="flex flex-col h-full -mx-6">
          {/* Full width tabs and content area */}
          <div className="flex-1 flex flex-col overflow-hidden">
          {companyLoading ? (
            <div className="px-6">
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-3">Loading company information...</span>
                </CardContent>
              </Card>
            </div>
          ) : !companyId ? (
            <div className="px-6">
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Please select a company to view analytics dashboards
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
              {/* Tabs with padding */}
              <div className="px-6 border-b">
                <TabsList className="w-full justify-start bg-transparent h-auto p-0 rounded-none">
                  {DASHBOARDS.map((dashboard) => (
                    <TabsTrigger
                      key={dashboard.id}
                      value={dashboard.id.toString()}
                      className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-3 flex items-center gap-2"
                    >
                      {getIcon(dashboard.icon)}
                      <span>{dashboard.name}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* Full width content area */}
              <div className="flex-1 overflow-auto">
                {DASHBOARDS.map((dashboard) => (
                  <TabsContent key={dashboard.id} value={dashboard.id.toString()} className="h-full mt-0">
                    {loading && (
                      <div className="h-full flex items-center justify-center">
                        <Card className="mx-6">
                          <CardContent className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <span className="ml-3">Loading dashboard...</span>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {embeddingUrl && !loading && selectedDashboard === dashboard.id && (
                      <div className="h-full flex flex-col">
                        <div className="flex-1 px-6 pb-6 pt-4">
                          {iframeError ? (
                            <Card className="h-full">
                              <CardContent className="flex flex-col items-center justify-center h-full py-12">
                                <BarChart3 className="h-12 w-12 text-destructive mb-4" />
                                <p className="text-destructive font-medium mb-2">Failed to load dashboard</p>
                                <p className="text-sm text-muted-foreground mb-4">
                                  There was an error loading the dashboard content.
                                </p>
                                <Button
                                  onClick={() => selectedDashboard && loadDashboard(selectedDashboard)}
                                  variant="outline"
                                >
                                  Retry
                                </Button>
                              </CardContent>
                            </Card>
                          ) : (
                            <div className="w-full h-full bg-white rounded-lg border shadow-sm overflow-hidden">
                              <iframe
                                src={embeddingUrl}
                                className="w-full h-full border-0"
                                title={`${selectedDashboardInfo?.name || 'Analytics'} Dashboard - Metabase`}
                                allow="clipboard-read; clipboard-write"
                                onError={handleIframeError}
                                onLoad={() => setIframeError(false)}
                                aria-label={`${selectedDashboardInfo?.name || 'Analytics'} dashboard content`}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {!embeddingUrl && !loading && selectedDashboard === dashboard.id && (
                      <div className="h-full flex items-center justify-center">
                        <Card className="mx-6">
                          <CardContent className="flex items-center justify-center py-12">
                            <div className="text-center">
                              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                              <p className="text-muted-foreground">
                                Loading dashboard...
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          )}
          </div>
        </div>
        )}
      </ProtectedPage>
    </DashboardLayout>
  )
}

