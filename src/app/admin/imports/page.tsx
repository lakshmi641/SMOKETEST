"use client";

import React, { useState, useEffect } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Download,
    History,
    Filter,
    Search,
    RefreshCw,
    FileSpreadsheet,
    CheckCircle2,
    AlertCircle,
    Clock
} from "lucide-react";
import { ImportJobService } from "@/lib/services/import/import-job-service";
import { ImportJob } from "@/lib/services/import/types/import-job-types";
import { useAuthStore } from '@/store/authStore';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useCompany } from '@/contexts/CompanyContext';

export default function ImportHistoryPage() {
    const [jobs, setJobs] = useState<ImportJob[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const { user } = useAuthStore();
    const { companyId, groupId } = useCompany();

    useEffect(() => {
        if (companyId) {
            loadJobs();
        }
    }, [companyId, groupId]);

    const loadJobs = async () => {
        if (!companyId) {
            console.warn("[ImportHistory] No companyId found");
            return;
        }
        setIsLoading(true);
        try {
            const result = await ImportJobService.queryJobs({
                companyId,
                groupId: groupId ?? undefined,
                limit: 50
            });
            setJobs(result);
        } catch (error: any) {
            console.error("Failed to load import history", error);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusBadge = (status: ImportJob['status']) => {
        switch (status) {
            case 'completed':
                return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</Badge>;
            case 'failed':
                return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
            case 'validating':
            case 'importing':
                return <Badge variant="outline" className="animate-pulse bg-blue-50 text-blue-700 border-blue-200"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Processing</Badge>;
            case 'review':
                return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" /> Review Pending</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const filteredJobs = jobs.filter(job =>
        job.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.importType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.userName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <DashboardLayout>
            <div className="space-y-8 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <p className="text-muted-foreground mt-1">
                            Track and audit all data import operations for your organization.
                        </p>
                    </div>
                    <Button onClick={loadJobs} variant="outline" className="rounded-xl">
                        <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-blue-50 to-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-blue-600">Total Imports</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{jobs.length}</div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-emerald-50 to-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-emerald-600">Success Rate</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {jobs.length > 0
                                    ? Math.round((jobs.filter(j => j.status === 'completed').length / jobs.length) * 100)
                                    : 0}%
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-purple-50 to-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-purple-600">Tasks Imported</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {jobs.reduce((acc, job) => acc + (job.stats?.importedCount || 0), 0)}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="rounded-1xl border-none overflow-hidden">
                    <CardHeader className="bg-muted/50 border-b">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by file name, type, or user..."
                                    className="pl-10 rounded-xl"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" className="rounded-xl"><Filter className="w-4 h-4" /></Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/20">
                                        <TableHead className="w-[200px]">Date</TableHead>
                                        <TableHead>File Name</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-center">Count</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        Array(5).fill(0).map((_, i) => (
                                            <TableRow key={i} className="animate-pulse">
                                                <TableCell colSpan={7} className="h-16 bg-muted/10"></TableCell>
                                            </TableRow>
                                        ))
                                    ) : filteredJobs.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <History className="w-12 h-12 opacity-20" />
                                                    <p>No import history found.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredJobs.map((job) => (
                                            <TableRow key={job.id} className="hover:bg-muted/5 transition-colors">
                                                <TableCell className="font-medium text-xs">
                                                    {format(job.createdAt instanceof Date ? job.createdAt : (job.createdAt as any).toDate(), 'MMM d, yyyy HH:mm')}
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate font-semibold">
                                                    <div className="flex items-center gap-2">
                                                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                                        {job.fileName}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="capitalize text-[10px] font-bold tracking-wider">
                                                        {job.importType.replace(/_/g, ' ')}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm">{job.userName}</TableCell>
                                                <TableCell>{getStatusBadge(job.status)}</TableCell>
                                                <TableCell className="text-center font-bold">
                                                    {job.stats?.importedCount || 0}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" className="rounded-lg h-8 px-2">
                                                        <Download className="w-4 h-4" />
                                                    </Button>
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
        </DashboardLayout>
    );
}
