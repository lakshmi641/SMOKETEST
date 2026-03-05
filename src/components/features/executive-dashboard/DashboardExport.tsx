'use client'

import React from 'react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Download, FileText, Share2, Printer, FileSpreadsheet } from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { ExecutiveDashboardData } from '@/types/executive-dashboard'

interface DashboardExportProps {
    data: ExecutiveDashboardData | null
}

export function DashboardExport({ data }: DashboardExportProps) {
    const handleExportCSV = () => {
        if (!data) return

        try {
            // Simple CSV Generation for Projects
            const headers = ['Project Name', 'Health Score', 'Status', 'Tasks Total', 'Tasks Completed']
            const rows = data.orgHierarchy.children?.filter(w => w.type === 'workspace')
                .flatMap(w => w.children || [])
                .filter(p => p.type === 'project')
                .map(p => [
                    p.name,
                    p.healthScore,
                    p.health,
                    p.metadata.totalTasks,
                    p.metadata.completedTasks
                ]) || []

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.join(','))
            ].join('\n')

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement('a')
            const url = URL.createObjectURL(blob)

            link.setAttribute('href', url)
            link.setAttribute('download', `CEO_Dashboard_Report_${new Date().toISOString().split('T')[0]}.csv`)
            link.style.visibility = 'hidden'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            toast.success('CSV Report generated successfully')
        } catch (error) {
            console.error('Export failed:', error)
            toast.error('Failed to generate CSV report')
        }
    }

    const handlePrint = () => {
        window.print()
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-8 font-bold border-dashed border-primary/50 hover:border-primary transition-all">
                    <Download className="h-4 w-4" />
                    Export Report
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2">
                <DropdownMenuLabel className="text-[10px] font-bold uppercase text-muted-foreground">Download Data</DropdownMenuLabel>
                <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer py-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                    <span>Project Status (CSV)</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuLabel className="text-[10px] font-bold uppercase text-muted-foreground">Print Options</DropdownMenuLabel>
                <DropdownMenuItem onClick={handlePrint} className="gap-2 cursor-pointer py-2">
                    <Printer className="h-4 w-4 text-blue-500" />
                    <span>Save as PDF (Print)</span>
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="gap-2 opacity-50 py-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>Executive Summary (Soon)</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem className="gap-2 cursor-pointer py-2" onClick={() => {
                    navigator.clipboard.writeText(window.location.href)
                    toast.success('Link copied to clipboard')
                }}>
                    <Share2 className="h-4 w-4 text-indigo-500" />
                    <span>Share Dashboard Link</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
