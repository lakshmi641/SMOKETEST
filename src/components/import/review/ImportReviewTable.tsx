"use client";

import React, { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Info,
    Search,
    Filter,
    MoreVertical,
    ChevronRight,
    ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ValidatedRow, CellValidationMessage, CellSuggestion } from "@/lib/services/import/types/import-types";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ImportReviewTableProps {
    rows: ValidatedRow[];
    headers: string[];
    onRowUpdate?: (rowNumber: number, field: string, value: any) => void;
    onRowDelete?: (rowIndex: number) => void;
}

export const ImportReviewTable: React.FC<ImportReviewTableProps> = ({
    rows,
    headers,
    onRowUpdate,
    onRowDelete
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [editingCell, setEditingCell] = useState<{ rowNumber: number, field: string } | null>(null);
    const [tempValue, setTempValue] = useState<string>('');

    const filteredRows = rows.filter(row =>
        Object.values(row.data).some(val =>
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        ) ||
        row.messages.some(m => m.message.toLowerCase().includes(searchTerm.toLowerCase()))
    );

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

    return (
        <div className="flex flex-col h-full bg-background border rounded-xl overflow-hidden shadow-sm">
            {/* Table Toolbar */}
            <div className="flex items-center justify-between p-4 border-b bg-muted/30 gap-4">
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search in import data..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-9 bg-background focus-visible:ring-primary"
                        />
                    </div>
                    <Button variant="outline" size="icon" className="h-9 w-9">
                        <Filter className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    {selectedRows.size > 0 && (
                        <Badge variant="secondary" className="px-3 py-1 text-xs">
                            {selectedRows.size} rows selected
                        </Badge>
                    )}
                    <div className="h-4 w-[1px] bg-border mx-2" />
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mr-2">
                        <span className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            {rows.filter(r => r.status === 'success').length} Valid
                        </span>
                        <span className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            {rows.filter(r => r.status === 'warning').length} Warnings
                        </span>
                        <span className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-rose-500" />
                            {rows.filter(r => r.status === 'error').length} Errors
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Table Area */}
            <div className="flex-1 overflow-auto">
                <TooltipProvider>
                    <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[50px]">
                                    <Checkbox
                                        checked={selectedRows.size === filteredRows.length && filteredRows.length > 0}
                                        onCheckedChange={toggleSelectAll}
                                    />
                                </TableHead>
                                <TableHead className="w-[80px]">Status</TableHead>
                                <TableHead className="w-[60px]">Row</TableHead>
                                {headers.map(header => (
                                    <TableHead key={header} className="min-w-[150px] font-semibold text-foreground">
                                        {header}
                                    </TableHead>
                                ))}
                                <TableHead className="min-w-[250px] font-semibold text-foreground">Validation Messages</TableHead>
                                <TableHead className="w-[50px] sticky right-0 bg-muted/50"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRows.map((row) => (
                                <TableRow
                                    key={row.rowNumber}
                                    className={cn(
                                        "group transition-all hover:bg-muted/30",
                                        selectedRows.has(row.rowNumber) && "bg-muted/50"
                                    )}
                                >
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedRows.has(row.rowNumber)}
                                            onCheckedChange={() => toggleSelectRow(row.rowNumber)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-center">
                                            {getStatusIcon(row.status)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                        {row.rowNumber}
                                    </TableCell>

                                    {headers.map(header => {
                                        const message = getCellMessage(row, header);
                                        const isDateField = header.toLowerCase().includes('date') || header.toLowerCase().includes('deadline') || header.toLowerCase().includes('start') || header.toLowerCase().includes('due');
                                        let value = row.data[header];

                                        if (isDateField && value) {
                                            const { formatDateForDisplay } = require('@/lib/utils/excel/date-parser');
                                            value = formatDateForDisplay(String(value));
                                        } else {
                                            value = value || '';
                                        }
                                        const isEditing = editingCell?.rowNumber === row.rowNumber && editingCell?.field === header;

                                        return (
                                            <TableCell
                                                key={`${row.rowNumber}-${header}`}
                                                onDoubleClick={() => {
                                                    setEditingCell({ rowNumber: row.rowNumber, field: header });
                                                    setTempValue(String(value));
                                                }}
                                                className={cn(
                                                    "relative group/cell px-4 py-3 border-r last:border-r-0 cursor-text hover:bg-muted/50 transition-colors h-14",
                                                    message?.severity === 'error' && "bg-rose-50/50 dark:bg-rose-950/20",
                                                    message?.severity === 'warning' && "bg-amber-50/50 dark:bg-amber-950/20",
                                                    isEditing && "bg-background p-1.5 shadow-inner !border-primary/50"
                                                )}
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
                                                        className="h-9 w-full rounded-md border-primary/30"
                                                    />
                                                ) : (
                                                    <div className="flex items-center justify-between gap-2 overflow-hidden">
                                                        <span className={cn(
                                                            "truncate",
                                                            !value && "text-muted-foreground italic text-xs",
                                                            message?.severity === 'error' && "text-rose-700 dark:text-rose-400 font-medium",
                                                            message?.severity === 'warning' && "text-amber-700 dark:text-amber-400 font-medium"
                                                        )}>
                                                            {value || '(empty)'}
                                                        </span>

                                                        {message && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className="cursor-help flex-shrink-0">
                                                                        {message.severity === 'error' ? (
                                                                            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                                                                        ) : (
                                                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                                                        )}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="p-3 max-w-[250px] bg-popover border-border shadow-xl rounded-lg">
                                                                    <p className="text-xs font-medium mb-1.5">{message.message}</p>
                                                                    {message.suggestion && (
                                                                        <div className="mt-2 p-2 rounded bg-muted/50 border border-dashed border-primary/30">
                                                                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-bold">Suggested Value</p>
                                                                            <p className="text-xs text-primary font-semibold">{message.suggestion.label}</p>
                                                                        </div>
                                                                    )}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                    </div>
                                                )}
                                            </TableCell>
                                        );
                                    })}

                                    <TableCell className="min-w-[250px] py-3">
                                        <div className="flex flex-col gap-1.5">
                                            {row.messages.length > 0 ? (
                                                row.messages.map((m, idx) => (
                                                    <div
                                                        key={`${row.rowNumber}-msg-${idx}`}
                                                        className={cn(
                                                            "text-[11px] leading-tight flex items-start gap-1.5 p-1.5 rounded-md",
                                                            m.severity === 'error' ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                                                        )}
                                                    >
                                                        {m.severity === 'error' ? (
                                                            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                                        ) : (
                                                            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                                                        )}
                                                        <span>
                                                            <span className="font-bold mr-1">{m.field}:</span>
                                                            {m.message}
                                                        </span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium px-2 py-1 bg-emerald-50 rounded-md border border-emerald-100 w-fit">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    Ready to import
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>

                                    <TableCell className="sticky right-0 bg-background/80 group-hover:bg-muted/50 backdrop-blur-sm border-l text-center p-0">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreVertical className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TooltipProvider>
            </div>

            {/* Footer / Summary */}
            <div className="p-3 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground whitespace-nowrap overflow-x-auto">
                <div className="flex items-center gap-4">
                    <span>Showing {filteredRows.length} of {rows.length} rows</span>
                    {searchTerm && <span>(Filtered)</span>}
                </div>
                <div className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5" />
                    <span>Double-click a cell to edit or resolve issues manually.</span>
                </div>
            </div>
        </div>
    );
};
