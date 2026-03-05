'use client'

import React from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, AlertTriangle, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface RiskProject {
    id: string
    name: string
    priority: string
    status: string
    healthScore: number
}

interface RiskDetailsDialogProps {
    isOpen: boolean
    onClose: () => void
    projects: RiskProject[]
}

export function RiskDetailsDialog({ isOpen, onClose, projects }: RiskDetailsDialogProps) {
    const router = useRouter()

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px] bg-background/95 backdrop-blur-sm shadow-2xl border border-border/50">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-full bg-rose-500/10 text-rose-600">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <DialogTitle className="text-xl">High Risk Exposure</DialogTitle>
                    </div>
                    <DialogDescription>
                        Projects contributing to critical risk levels due to 'Urgent' or 'High' priority status.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4 border rounded-md overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Project Name</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {projects.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        No high-risk projects found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                projects.map((project) => (
                                    <TableRow key={project.id} className="group">
                                        <TableCell className="font-medium">
                                            {project.name}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={
                                                project.priority === 'urgent'
                                                    ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                                    : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                            }>
                                                {project.priority}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="capitalize text-muted-foreground text-sm">
                                            {project.status}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => {
                                                    onClose()
                                                    router.push(`/projects/${project.id}`)
                                                }}
                                            >
                                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    )
}
