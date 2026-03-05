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
import { ArrowLeft, ExternalLink, AlertCircle, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AtRiskProjectsPage() {
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

    const projects = data?.strategicHealth.details?.atRiskProjects || []
    const filteredProjects = projects.filter(p =>
        (p.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (p.workspaceName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (p.manager?.toLowerCase() || '').includes(searchQuery.toLowerCase())
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
                                    <h1 className="text-3xl font-bold tracking-tight">At-Risk Projects</h1>
                                    <p className="text-muted-foreground mt-1">
                                        Comprehensive list of projects requiring immediate management attention.
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative w-64">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search projects..."
                                            className="pl-9"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <Badge variant="destructive" className="h-9 px-4 text-sm font-bold">
                                        {projects.length} Projects at Risk
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <Card className="border-border/50 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b border-border/40 py-4">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-red-500" />
                                Project Health Registry
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/10">
                                    <TableRow>
                                        <TableHead className="pl-6 w-[30%]">Project Name</TableHead>
                                        <TableHead>Workspace</TableHead>
                                        <TableHead>Project Manager</TableHead>
                                        <TableHead>Health Score</TableHead>
                                        <TableHead className="text-right pr-6">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell colSpan={5} className="h-16 animate-pulse bg-muted/5" />
                                            </TableRow>
                                        ))
                                    ) : filteredProjects.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-64 text-center">
                                                <p className="text-muted-foreground">No matching at-risk projects found.</p>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredProjects.map((project) => (
                                            <TableRow key={project.id} className="group hover:bg-muted/30 transition-colors">
                                                <TableCell className="pl-6 font-semibold py-4">
                                                    {project.name}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="font-medium bg-background">
                                                        {project.workspaceName}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-7 w-7 rounded-full bg-primary/5 flex items-center justify-center text-[10px] font-bold text-primary">
                                                            {project.manager.charAt(0)}
                                                        </div>
                                                        <span className="text-sm font-medium">{project.manager}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-2 w-24 bg-muted rounded-full overflow-hidden shrink-0">
                                                            <div
                                                                className={`h-full ${project.healthScore < 40 ? 'bg-red-500' : 'bg-orange-500'}`}
                                                                style={{ width: `${project.healthScore}%` }}
                                                            />
                                                        </div>
                                                        <span className={`text-sm font-black ${project.healthScore < 40 ? 'text-red-600' : 'text-orange-600'}`}>
                                                            {project.healthScore}%
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="gap-2"
                                                        onClick={() => router.push(`/projects/${project.id}`)}
                                                    >
                                                        Details
                                                        <ExternalLink className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </ProtectedPage>
        </DashboardLayout>
    )
}
