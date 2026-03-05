'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProtectedPage } from '@/components/auth/ProtectedPage'
import { useAuthStore } from '@/store/authStore'
import { useCompany } from '@/contexts/CompanyContext'
import { useExecutiveFilters } from '@/hooks/useExecutiveFilters'
import { useExecutiveDashboardData } from '@/hooks/useExecutiveDashboardData'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, User, Search, User2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export default function ResourceUtilizationPage() {
    const router = useRouter()
    const { user } = useAuthStore()
    const { companyId, groupId } = useCompany()
    const { viewScope, dateRange } = useExecutiveFilters()
    const [searchQuery, setSearchQuery] = React.useState('')

    const { data, isLoading } = useExecutiveDashboardData({
        groupId: groupId ?? undefined,
        companyId: companyId || '',
        userId: user?.id || '',
        viewScope,
        dateRange
    })

    const resources = data?.strategicHealth.details?.underutilizedResources || []
    const filteredResources = resources.filter(r =>
        (r.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (r.positionTitle?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (r.positionCode?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (r.orgUnit?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (r.reportsToName?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    )

    return (
        <DashboardLayout>
            <ProtectedPage>
                <div className="flex flex-col gap-6 max-w-[1600px] mx-auto relative">
                    {/* Sticky Header Section */}
                    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md pt-4 pb-6 border-b -mx-6 px-6 mb-2 before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-background/95 before:backdrop-blur-md before:content-['']">
                        <div className="flex flex-col gap-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-fit gap-2 -ml-2 text-muted-foreground hover:text-foreground"
                                onClick={() => router.push('/executive-dashboard')}
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to Executive Dashboard
                            </Button>
                            <div className="flex justify-between items-end">
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight">Resource Utilization</h1>
                                    <p className="text-muted-foreground mt-1">
                                        Comprehensive view of team availability and organizational alignment.
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative w-64">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search resources..."
                                            className="pl-9"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <Badge variant="secondary" className="h-9 px-4 text-sm font-bold bg-green-100 text-green-700 hover:bg-green-200">
                                        {resources.length} Available Resources
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <Card className="border-border/50 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b border-border/40 py-4">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <User className="h-4 w-4 text-green-500" />
                                Availability Registry
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/10">
                                        <TableRow>
                                            <TableHead className="pl-6 min-w-[200px]">Employee Name</TableHead>
                                            <TableHead>Position & Code</TableHead>
                                            <TableHead>Org Unit</TableHead>
                                            <TableHead>Reports To (Manager & Position)</TableHead>
                                            <TableHead className="text-center">Assigned Tasks</TableHead>
                                            <TableHead className="text-right pr-6">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <TableRow key={i}>
                                                    <TableCell colSpan={6} className="h-16 animate-pulse bg-muted/5" />
                                                </TableRow>
                                            ))
                                        ) : filteredResources.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-64 text-center">
                                                    <p className="text-muted-foreground">No resources found matching your search.</p>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredResources.map((resource) => (
                                                <TableRow key={resource.userId} className="group hover:bg-muted/30 transition-colors">
                                                    <TableCell className="pl-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-8 w-8 border border-border/60">
                                                                <AvatarFallback className="text-[10px] font-bold bg-slate-100 text-primary uppercase">
                                                                    {resource.name.charAt(0)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <span className="font-semibold text-sm">{resource.name}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-xs font-bold text-slate-700">{resource.positionTitle}</span>
                                                            <span className="text-[10px] text-muted-foreground uppercase">{resource.positionCode || 'N/A'}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                                            {resource.orgUnit}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-medium">{resource.reportsToName || 'None'}</span>
                                                            <span className="text-[10px] text-muted-foreground italic">{resource.reportsToPositionTitle || 'N/A'}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <span className="text-sm font-black text-foreground">{resource.assignedTasks}</span>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-200 border-none text-[10px] font-bold">
                                                            AVAILABLE
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </ProtectedPage>
        </DashboardLayout>
    )
}
