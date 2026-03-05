"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { List } from 'react-window';

import { formatDate } from '@/lib/utils/date-utils'
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Info,
    Search,
    Filter,
    ChevronDown,
    MoreVertical,
    Wand2,
    Eye,
    Table as TableIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ValidatedRow, CellValidationMessage } from "@/lib/services/import/types/import-types";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from "@/components/ui/command";
import { EntityLookupService } from '@/lib/services/import/entity-lookup-service';
import { ScrollArea } from "@/components/ui/scroll-area";
import { MemberSelect } from "@/components/common/MemberSelect";

interface VirtualImportReviewTableProps {
    rows: ValidatedRow[];
    headers: string[];
    onRowUpdate?: (rowNumber: number, field: string, value: any) => void;
    onRowResolve?: (rowNumber: number, field: string, value: string, message?: string) => void;
    onRowDelete?: (rowIndex: number) => void;
    companyId: string;
    workspaceId: string;
}

export const VirtualImportReviewTable: React.FC<VirtualImportReviewTableProps> = ({
    rows,
    headers,
    onRowUpdate,
    onRowResolve,
    onRowDelete,
    companyId,
    workspaceId
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [editingCell, setEditingCell] = useState<{ rowNumber: number, field: string } | null>(null);
    const [tempValue, setTempValue] = useState<string>('');

    // Responsive Sizing
    const containerRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const node = containerRef.current;
        if (!node) return;

        const update = () => {
            setDimensions({
                width: node.offsetWidth,
                height: node.offsetHeight
            });
        };

        update();
        const observer = new ResizeObserver(update);
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    // Sync horizontal scroll between header and body
    useEffect(() => {
        const header = headerRef.current;
        const body = bodyRef.current;
        if (!header || !body) return;

        const syncScroll = (e: Event) => {
            const target = e.target as HTMLElement;
            if (target === body) {
                header.scrollLeft = body.scrollLeft;
            } else if (target === header) {
                body.scrollLeft = header.scrollLeft;
            }
        };

        header.addEventListener('scroll', syncScroll);
        body.addEventListener('scroll', syncScroll);
        return () => {
            header.removeEventListener('scroll', syncScroll);
            body.removeEventListener('scroll', syncScroll);
        };
    }, []);

    // Filter rows based on search
    const filteredRows = useMemo(() => {
        if (!searchTerm) return rows;
        const lowerSearch = searchTerm.toLowerCase();
        return rows.filter(row =>
            Object.values(row.data).some(val =>
                String(val).toLowerCase().includes(lowerSearch)
            ) ||
            row.messages.some(m => m.message.toLowerCase().includes(lowerSearch))
        );
    }, [rows, searchTerm]);

    const toggleSelectAll = () => {
        if (selectedRows.size === filteredRows.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(filteredRows.map(r => r.rowNumber)));
        }
    };

    const toggleSelectRow = (rowNumber: number) => {
        const newSelected = new Set(selectedRows);
        if (newSelected.has(rowNumber)) {
            newSelected.delete(rowNumber);
        } else {
            newSelected.add(rowNumber);
        }
        setSelectedRows(newSelected);
    };

    const getStatusIcon = (status: ValidatedRow['status']) => {
        switch (status) {
            case 'success':
                return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'warning':
                return <AlertTriangle className="w-4 h-4 text-amber-500" />;
            case 'error':
                return <AlertCircle className="w-4 h-4 text-rose-500" />;
        }
    };

    const getCellMessage = (row: ValidatedRow, field: string) => {
        return row.messages.find(m => m.field.toLowerCase() === field.toLowerCase());
    };

    // Layout Constants for Perfect Sync
    const COL_WIDTH = 200;
    const ROW_WIDTH = 60;
    const STATUS_WIDTH = 120; // Slightly wider for status badges
    const MSG_WIDTH = 350;

    // Filter 'Status' out of headers if it exists, as we will render it explicitly at the end
    const dataHeaders = headers.filter(h => h.toLowerCase() !== 'status');
    const hasStatusColumn = true; // We always show status at the end

    const totalWidth = ROW_WIDTH + (dataHeaders.length * COL_WIDTH) + STATUS_WIDTH + MSG_WIDTH;
    const gridTemplateColumns = `${ROW_WIDTH}px ${dataHeaders.map(() => `${COL_WIDTH}px`).join(' ')} ${STATUS_WIDTH}px ${MSG_WIDTH}px`;



    // Inline Resolution States
    const [popoverOpen, setPopoverOpen] = useState<{ row: number, field: string } | null>(null);
    const [options, setOptions] = useState<{ label: string, value: any }[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const loadCellOptions = async (fieldName: string) => {
        setIsLoading(true);
        setOptions([]); // Clear previous options to prevent stale data (e.g. categories showing for users)
        try {
            const normalized = fieldName.toLowerCase().trim().replace(/ /g, '');
            if (normalized === 'priority') {
                setOptions(['low', 'medium', 'high', 'urgent'].map(v => ({ label: v.toUpperCase(), value: v })));
            } else if (normalized === 'status') {
                setOptions(['open', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled', 'escalated'].map(v => ({
                    label: v.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                    value: v
                })));
            } else if (normalized === 'category') {
                setOptions(['onboarding', 'compliance', 'operational', 'project', 'training', 'maintenance', 'custom'].map(v => ({
                    label: v.toUpperCase(),
                    value: v
                })));
            } else if (normalized === 'project' || normalized === 'projectname') {
                if (!companyId) return;
                const projects = workspaceId
                    ? await EntityLookupService.fetchWorkspaceProjects(companyId, workspaceId)
                    : await EntityLookupService.fetchProjects(companyId);
                setOptions(projects.map(p => ({ label: p.name, value: p.id })));
            } else if (normalized === 'department' || normalized === 'dept') {
                if (!companyId) return;
                const depts = await EntityLookupService.fetchDepartments(companyId);
                setOptions(depts.map(d => ({ label: d.name, value: d.id })));
            } else if (normalized === 'team') {
                if (!companyId) return;
                const teams = await EntityLookupService.fetchTeams(companyId);
                setOptions(teams.map(t => ({ label: t.name, value: t.id })));
            } else if (normalized === 'assigneduser' || normalized === 'assignee' || normalized === 'reporter') {
                if (!companyId) return;

                let users: any[] = [];
                // 1. Fetch workspace-specific users if context available
                if (workspaceId) {
                    users = await EntityLookupService.fetchWorkspaceUsers(companyId, workspaceId);
                }

                // 2. Fallback to all company users if no workspace members found or no workspace context
                if (users.length === 0) {
                    users = await EntityLookupService.fetchUsers(companyId);
                }


                setOptions(users.map((u: any) => ({ label: u.name, value: u.id })));
            } else if (normalized.includes('tasktype') || (normalized.includes('task') && normalized.includes('type'))) {

                if (!companyId) return;
                const types = await EntityLookupService.fetchTaskTypes(companyId);
                console.log('[VirtualImportReviewTable] Loaded Task Types:', types);

                // Fallback to default task types if database is empty
                if (types.length === 0) {
                    setOptions([
                        { label: 'Operations', value: 'Operations' },
                        { label: 'Compliance', value: 'Compliance' },
                        { label: 'Maintenance', value: 'Maintenance' },
                        { label: 'Training', value: 'Training' },
                        { label: 'Project', value: 'Project' },
                        { label: 'Safety', value: 'Safety' },
                        { label: 'Quality', value: 'Quality' },
                        { label: 'Other', value: 'Other' },
                    ]);
                } else {
                    setOptions(types.map(t => ({ label: t.name, value: t.name })));
                }
            } else if (normalized.includes('requirementtype') || (normalized.includes('requirement') && normalized.includes('type'))) {
                if (!companyId) return;
                const types = await EntityLookupService.fetchRequirementTypes(companyId);

                // Fallback to default requirement types if database is empty
                if (types.length === 0) {
                    setOptions([
                        { label: 'Regulatory', value: 'Regulatory' },
                        { label: 'Internal', value: 'Internal' },
                        { label: 'Customer', value: 'Customer' },
                        { label: 'Audit', value: 'Audit' },
                        { label: 'Safety', value: 'Safety' },
                        { label: 'Quality', value: 'Quality' },
                        { label: 'Other', value: 'Other' },
                    ]);
                } else {
                    setOptions(types.map(t => ({ label: t.name, value: t.name })));
                }
            } else if (normalized === 'assignmenttype' || normalized === 'assignmentstrategy') {
                setOptions(['Specific User', 'Position / Role'].map(v => ({ label: v, value: v })));
            } else if (normalized === 'frequency') {
                setOptions(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'].map(v => ({ label: v, value: v.toLowerCase() })));
            } else if (normalized === 'timezone') {
                setOptions(['Asia/Kolkata', 'UTC', 'America/New_York', 'Europe/London', 'Asia/Dubai', 'Asia/Singapore'].map(v => ({ label: v, value: v })));
            } else if (normalized === 'endtype') {
                setOptions(['Never', 'On Date', 'After Count'].map(v => ({ label: v, value: v })));
            } else if (normalized === 'position' || normalized === 'role') {
                if (!companyId) return;
                const positions = await EntityLookupService.fetchPositions(companyId);
                setOptions(positions.map(p => ({ label: p.title, value: p.id })));
            } else if (normalized === 'deptype') {
                setOptions(['FS', 'SS', 'FF', 'SF'].map(v => ({ label: v, value: v })));
            } else if (normalized === 'milestone') {
                setOptions(['Yes', 'No'].map(v => ({ label: v, value: v })));
            } else if (normalized === 'predecessor') {
                // Fetch current batch titles
                const batchTitles = rows.map(r => r.data['Task Name'] || r.data['taskName'] || r.data['Task Title'] || r.data['taskTitle']).filter(t => !!t);
                const uniqueBatchTitles = Array.from(new Set(batchTitles));

                // Fetch existing project tasks if available
                const projectTasks: { label: string, value: string }[] = [];
                if (companyId && workspaceId) {
                    // Note: We'd ideally need project ID here too, but for resolution we can show batch titles primarily
                    // If we have a project context, EntityLookupService.fetchProjectTasks(projectId) could be used
                }

                setOptions(uniqueBatchTitles.map(t => ({ label: String(t), value: String(t) })));
            } else {
                setOptions([]); // No options for other fields (Numbers, Dates)
            }
        } catch (err) {
            console.error("Failed to load options", err);
            setOptions([]);
        } finally {
            setIsLoading(false);
        }
    };

    const Row = ({ index, style }: any) => {
        const row = filteredRows[index];
        if (!row) return null;
        const isSelected = selectedRows.has(row.rowNumber);

        // EXTRA DEFENSE: Filter out Status errors that should be system-managed
        const activeMessages = row.messages.filter(m => m.field.toLowerCase() !== 'status');
        const hasError = activeMessages.some(m => m.severity === 'error');
        const displayStatus = hasError ? 'error' : (activeMessages.some(m => m.severity === 'warning') ? 'warning' : 'success');

        return (
            <div
                style={{ ...style, width: totalWidth }}
                className={cn(
                    "grid items-center border-b transition-colors hover:bg-muted/30 text-sm bg-background",
                    isSelected && "bg-muted/50"
                )}
            >
                <div className="grid h-full w-full" style={{ gridTemplateColumns }}>
                    {/* Row Num (Scrollable) */}
                    <div className="flex items-center justify-center border-r h-full font-mono text-xs text-muted-foreground bg-muted/5 z-20 shadow-[1px_0_0_rgb(229,231,235)]">
                        {row.rowNumber - 1}
                    </div>

                    {/* Data Cells */}
                    {dataHeaders.map(header => {
                        const message = activeMessages.find(m => m.field.toLowerCase() === header.toLowerCase());
                        const lowerHeader = header.toLowerCase();
                        const isDateField = lowerHeader.includes('date') || lowerHeader.includes('deadline') || lowerHeader.includes('schedule') || lowerHeader === 'start' || lowerHeader === 'end' || lowerHeader === 'due';

                        let value = row.data[header];
                        if (isDateField && value) {
                            const { formatDateForDisplay } = require('@/lib/utils/excel/date-parser');
                            value = formatDateForDisplay(String(value));
                        } else {
                            value = value || '';
                        }

                        const isEditing = editingCell?.rowNumber === row.rowNumber && editingCell?.field === header;

                        // Customize error message for clarity
                        let displayMessage = message?.message;
                        if (message?.message.includes('misspelled')) {
                            displayMessage = `The value provided is not recognized. Please click "Resolve" to select a valid option.`;
                        } else if (message?.message.includes('not found')) {
                            displayMessage = message.message + '. Please ensure the item exists or select from the list.';
                        }

                        return (
                            <div
                                key={`${row.rowNumber}-${header}`}
                                className={cn(
                                    "relative px-4 py-2 border-r h-full flex items-center overflow-hidden cursor-text transition-colors",
                                    message?.severity === 'error' && "bg-rose-50/80 dark:bg-rose-950/20 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.1)] cursor-pointer hover:bg-rose-100/80",
                                    message?.severity === 'warning' && "bg-amber-50/80 dark:bg-amber-950/20 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.1)]",
                                    isEditing && "bg-background p-1.5 shadow-inner !border-primary/50"
                                )}
                                onDoubleClick={(e) => {
                                    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[role="button"]')) return;
                                    setEditingCell({ rowNumber: row.rowNumber, field: header });
                                    setTempValue(String(row.data[header] || ''));
                                }}
                                style={{ width: COL_WIDTH }}
                            >
                                {isEditing ? (
                                    <Input
                                        autoFocus
                                        value={tempValue}
                                        onChange={(e) => setTempValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                onRowUpdate?.(row.rowNumber, header, tempValue);
                                                setEditingCell(null);
                                            } else if (e.key === 'Escape') {
                                                setEditingCell(null);
                                            }
                                        }}
                                        onBlur={() => {
                                            if (tempValue !== String(value)) {
                                                onRowUpdate?.(row.rowNumber, header, tempValue);
                                            }
                                            setEditingCell(null);
                                        }}
                                        className="h-8 w-full rounded-md border-primary/30 text-xs"
                                    />
                                ) : (
                                    <div className="flex items-center justify-between gap-2 w-full truncate group/cell">
                                        <span
                                            className={cn(
                                                "truncate block flex-1",
                                                !value && "text-muted-foreground/40 italic text-xs",
                                                message?.severity === 'error' && "text-rose-700 dark:text-rose-400 font-medium",
                                                message?.severity === 'warning' && "text-amber-700 dark:text-amber-400 font-medium"
                                            )}
                                        >
                                            {String(value || 'Empty')}
                                        </span>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {/* Resolution / Selection Trigger */}
                                            {(() => {
                                                const normalizedHeader = header.toLowerCase().replace(/ /g, '');
                                                const resolvableFields = [
                                                    'project', 'projectname', 'department', 'dept',
                                                    'priority', 'status', 'category', 'tasktype', 'requirementtype',
                                                    'team', 'predecessor', 'deptype', 'lagdays', 'milestone',
                                                    'frequency', 'timezone', 'endtype', 'assignmenttype', 'assignmentstrategy', 'position', 'role'
                                                ];

                                                // 1. Special Handling for Member Selection (User/Position)
                                                if (['assigneduser', 'assignee', 'reporter'].includes(normalizedHeader)) {
                                                    // Use MemberSelect for smart position/user picking
                                                    return (
                                                        <div className="w-full">
                                                            <MemberSelect
                                                                workspaceId={workspaceId}
                                                                placeholder={String(value) || "Select..."}
                                                                className={cn(
                                                                    "h-7 text-[10px] px-2 w-full border-none shadow-none bg-transparent hover:bg-black/5",
                                                                    message?.severity === 'error' && "text-rose-600 font-bold bg-rose-50 hover:bg-rose-100",
                                                                    !value && "italic text-muted-foreground"
                                                                )}
                                                                // Use dummy value to display the current text from Excel
                                                                value={value ? {
                                                                    type: 'user', // dummy
                                                                    id: 'dummy',
                                                                    label: String(value)
                                                                } : undefined}
                                                                onValueChange={(val) => {
                                                                    if (val) {
                                                                        // Update with the LABEL (Name or formatted Position Title)
                                                                        onRowUpdate?.(row.rowNumber, header, val.label);
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    );
                                                }

                                                // 2. Standard Popover for other fields
                                                const isResolvable = resolvableFields.includes(normalizedHeader);

                                                if (isResolvable) {
                                                    return (
                                                        <div className="ml-auto pl-2">
                                                            <Popover open={popoverOpen?.row === row.rowNumber && popoverOpen?.field === header} onOpenChange={(open) => {
                                                                if (open) {
                                                                    setPopoverOpen({ row: row.rowNumber, field: header });
                                                                    loadCellOptions(header);
                                                                } else {
                                                                    setPopoverOpen(null);
                                                                }
                                                            }}>
                                                                <PopoverTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className={cn(
                                                                            "h-7 px-2 text-[10px] font-bold uppercase rounded-md flex items-center gap-1.5 transition-all shadow-sm",
                                                                            message?.severity === 'error'
                                                                                ? "bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white"
                                                                                : "bg-primary/10 text-primary hover:bg-primary hover:text-white"
                                                                        )}
                                                                    >
                                                                        <Wand2 className="w-3 h-3" />
                                                                        {message?.severity === 'error' ? 'Resolve' : 'Select'}
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent
                                                                    className="p-0 w-64 shadow-2xl border-none ring-1 ring-black/5"
                                                                    align="start"
                                                                    sideOffset={5}
                                                                    avoidCollisions={true}
                                                                >
                                                                    <Command className="rounded-xl overflow-hidden">
                                                                        <CommandInput placeholder={`Search ${header}...`} className="h-9" />
                                                                        <CommandEmpty>No options found.</CommandEmpty>
                                                                        <ScrollArea className="h-64">
                                                                            <CommandGroup>
                                                                                {isLoading ? (
                                                                                    <div className="p-4 flex items-center justify-center">
                                                                                        <Wand2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                                                                    </div>
                                                                                ) : (
                                                                                    options.map((opt) => (
                                                                                        <CommandItem
                                                                                            key={opt.value}
                                                                                            value={opt.label}
                                                                                            onSelect={() => {
                                                                                                onRowUpdate?.(row.rowNumber, header, opt.label);
                                                                                                setPopoverOpen(null);
                                                                                            }}
                                                                                            className="text-xs py-2.5 px-3 cursor-pointer"
                                                                                        >
                                                                                            <div className="flex items-center justify-between w-full">
                                                                                                <span>{opt.label}</span>
                                                                                                {opt.value === value && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                                                                                            </div>
                                                                                        </CommandItem>
                                                                                    ))
                                                                                )}
                                                                            </CommandGroup>
                                                                        </ScrollArea>
                                                                    </Command>
                                                                </PopoverContent>
                                                            </Popover>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}

                                            {message && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="cursor-help flex-shrink-0 animate-in fade-in slide-in-from-right-1">
                                                                {message.severity === 'error' ? (
                                                                    <AlertCircle className="w-4 h-4 text-rose-500" />
                                                                ) : (
                                                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                                )}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="p-3 max-w-[300px]">
                                                            <p className="text-xs font-semibold mb-1.5 text-rose-600 uppercase tracking-tight">Issue Detected</p>
                                                            <p className="text-xs font-medium mb-2 leading-relaxed">{displayMessage}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Status Column (Editable) */}
                    <div className="flex items-center justify-center border-r h-full px-2 bg-muted/5 z-20 shadow-[1px_0_0_rgb(229,231,235)]">
                        <Popover open={popoverOpen?.row === row.rowNumber && popoverOpen?.field === 'Status'} onOpenChange={(open) => {
                            if (open) {
                                setPopoverOpen({ row: row.rowNumber, field: 'Status' });
                                loadCellOptions('Status');
                            } else {
                                setPopoverOpen(null);
                            }
                        }}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "px-2.5 py-1 h-auto rounded-md text-[10px] font-bold uppercase tracking-wider border hover:bg-accent",
                                        row.data['Status'] ? "bg-background border-border text-foreground" : "bg-muted text-muted-foreground border-transparent"
                                    )}
                                >
                                    {row.data['Status'] || 'Click to Set'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="p-0 w-64 shadow-2xl border-none ring-1 ring-black/5"
                                align="center"
                                sideOffset={5}
                                avoidCollisions={true}
                            >
                                <Command className="rounded-xl overflow-hidden">
                                    <CommandInput placeholder="Search status..." className="h-9" />
                                    <CommandEmpty>No options found.</CommandEmpty>
                                    <ScrollArea className="h-64">
                                        <CommandGroup>
                                            {isLoading ? (
                                                <div className="p-4 flex items-center justify-center">
                                                    <Wand2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                                </div>
                                            ) : (
                                                options.map((opt) => (
                                                    <CommandItem
                                                        key={opt.value}
                                                        value={opt.label}
                                                        onSelect={() => {
                                                            onRowUpdate?.(row.rowNumber, 'Status', opt.label);
                                                            setPopoverOpen(null);
                                                        }}
                                                        className="text-xs py-2.5 px-3 cursor-pointer"
                                                    >
                                                        <div className="flex items-center justify-between w-full">
                                                            <span>{opt.label}</span>
                                                            {opt.value === row.data['Status'] && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                                                        </div>
                                                    </CommandItem>
                                                ))
                                            )}
                                        </CommandGroup>
                                    </ScrollArea>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Messages Summary */}
                    <div
                        className={cn(
                            "px-4 py-2 border-r h-full overflow-hidden flex flex-col justify-center bg-muted/5 transition-colors",
                            displayStatus === 'error' && "cursor-pointer hover:bg-rose-100/50"
                        )}
                        onClick={() => {
                            if (displayStatus === 'error' && onRowResolve) {
                                // Find the first error message to resolve
                                const firstError = activeMessages.find(m => m.severity === 'error');
                                if (firstError) {
                                    onRowResolve(row.rowNumber, firstError.field, String(row.data[firstError.field] || ''), firstError.message);
                                }
                            }
                        }}
                    >
                        <div className="flex flex-col gap-1">
                            {activeMessages.length > 0 ? (
                                activeMessages.slice(0, 1).map((m, idx) => (
                                    <div key={idx} className={cn(
                                        "text-[11px] truncate flex items-center gap-1.5 font-medium",
                                        m.severity === 'error' ? "text-rose-600" : "text-amber-600"
                                    )}>
                                        <AlertCircle className="w-3 h-3 shrink-0" />
                                        <span><span className="font-bold">{m.field}:</span> {m.message.length > 60 ? 'Invalid selection' : m.message}</span>
                                    </div>
                                ))
                            ) : (
                                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5 animate-in fade-in">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                                </span>
                            )}
                            {activeMessages.length > 1 && (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground ml-4">+{activeMessages.length - 1} more issues</span>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        );
    };

    return (
        <div
            ref={containerRef}
            className="plugin-import-table flex flex-col h-full bg-background border rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/5"
        >
            {/* Toolbar */}
            <div className="flex items-center justify-between p-4 bg-background/50 backdrop-blur-md border-b gap-4 flex-shrink-0">
                <div className="flex items-center gap-4 flex-1">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <TableIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Filter import data..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-10 bg-muted/50 border-none shadow-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded-xl"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-2">
                    <span className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {rows.filter(r => r.status === 'success' || !r.messages.some(m => m.severity === 'error' && m.field.toLowerCase() !== 'status')).length} Valid
                    </span>
                    <span className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {rows.filter(r => r.status === 'warning' && !r.messages.some(m => m.severity === 'error')).length} Warning
                    </span>
                    <span className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-full border border-rose-100">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        {rows.filter(r => r.messages.some(m => m.severity === 'error' && m.field.toLowerCase() !== 'status')).length} Needs Attention
                    </span>
                </div>
            </div>

            {/* Fixed Header */}
            <div
                ref={headerRef}
                className="overflow-x-hidden scrollbar-none bg-muted"
                style={{ overflowY: 'hidden' }}
            >
                <div
                    className="bg-muted font-bold text-[10px] uppercase tracking-[0.15em] text-muted-foreground shadow-md flex-shrink-0"
                    style={{ width: totalWidth, minWidth: '100%' }}
                >
                    <div className="grid h-12" style={{ gridTemplateColumns, width: totalWidth }}>
                        <div className="flex items-center justify-center border-r h-full px-2 border-b z-20 bg-muted/80 shadow-[1px_0_0_rgb(229,231,235)]">Row</div>
                        {dataHeaders.map(h => (
                            <div key={h} className="flex items-center border-r h-full px-4 truncate border-b bg-muted/80" title={h}>
                                {h}
                            </div>
                        ))}
                        <div className="flex items-center justify-center border-r h-full px-2 border-b z-20 bg-muted/80 shadow-[1px_0_0_rgb(229,231,235)]">Status</div>
                        <div className="flex items-center border-r h-full px-4 border-b bg-muted/80 rounded-tr-2xl">Validation Summary</div>
                    </div>
                </div>
            </div>

            {/* Virtualized Body */}
            <div
                ref={bodyRef}
                className="flex-1 min-h-0 overflow-auto scrollbar-primary bg-muted/5 shadow-inner"
            >
                <TooltipProvider delayDuration={0}>
                    {dimensions.width > 0 && dimensions.height > 0 && (
                        // @ts-ignore - react-window version props
                        <List
                            rowCount={filteredRows.length}
                            rowHeight={64}
                            rowComponent={Row}
                            rowProps={{}}
                            style={{
                                width: totalWidth,
                                height: dimensions.height - 120
                            }}
                            className=""
                        />
                    )}
                </TooltipProvider>
            </div>

            <div className="p-3 border-t bg-muted/30 text-[10px] font-bold text-muted-foreground flex justify-between flex-shrink-0 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <span className="bg-background px-2 py-1 rounded-md border shadow-sm">Total Rows: {rows.length}</span>
                    <span className="bg-background px-2 py-1 rounded-md border shadow-sm">Matched Results: {filteredRows.length}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="uppercase tracking-widest">UltraSync™ Engine Active</span>
                </div>
            </div>
        </div >
    );
};
