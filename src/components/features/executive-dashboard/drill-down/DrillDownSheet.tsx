'use client'

import React from 'react'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet'
import { DrillDownBreadcrumb } from './DrillDownBreadcrumb'
import { WorkspaceDetailView } from './WorkspaceDetailView'
import { ProjectDetailView } from './ProjectDetailView'
import { MatrixQuadrantView } from './MatrixQuadrantView'
import { Skeleton } from '@/components/ui/skeleton'

interface DrillDownSheetProps {
    isOpen: boolean
    onClose: () => void
    level: 'organization' | 'workspace' | 'project' | 'matrix'
    selectedId: string | null
    selectedName: string | null
    selectedData: any | null
    breadcrumb: any[]
    onNavigate: (item: any) => void
    onProjectClick: (id: string, name: string) => void
}

export function DrillDownSheet({
    isOpen,
    onClose,
    level,
    selectedId,
    selectedName,
    selectedData,
    breadcrumb,
    onNavigate,
    onProjectClick
}: DrillDownSheetProps) {
    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto bg-background/95 backdrop-blur-sm border-l border-border/10 shadow-2xl p-0">
                <div className="flex flex-col h-full">
                    {/* Header Section */}
                    <div className="p-6 border-b border-border/40 bg-muted/30 sticky top-0 z-10">
                        <DrillDownBreadcrumb items={breadcrumb} onNavigate={onNavigate} />

                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
                                {level} Detail
                            </span>
                            <SheetTitle className="text-2xl font-bold tracking-tight">
                                {selectedName || 'Detail View'}
                            </SheetTitle>
                            <SheetDescription className="text-sm">
                                Performance breakdown and real-time status metrics
                            </SheetDescription>
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 p-6">
                        {level === 'workspace' && selectedId && (
                            <WorkspaceDetailView
                                workspaceId={selectedId}
                                data={selectedData}
                                onProjectClick={onProjectClick}
                            />
                        )}

                        {level === 'project' && selectedId && (
                            <ProjectDetailView
                                projectId={selectedId}
                                data={selectedData}
                            />
                        )}

                        {level === 'matrix' && selectedId && (
                            <MatrixQuadrantView
                                quadrantId={selectedId}
                                quadrantName={selectedName || ''}
                                items={selectedData}
                            />
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
