import React, { useState, useEffect } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import {
    ImportType,
    getAllExpectedHeaders,
    getRequiredHeaders
} from "@/lib/services/import/types/import-types";

interface ColumnMapperProps {
    importType: ImportType;
    excelHeaders: string[];
    onMappingChange: (mapping: Record<string, string>) => void;
    initialMapping?: Record<string, string>;
    projectId?: string;
}

export const ColumnMapper: React.FC<ColumnMapperProps> = ({
    importType,
    excelHeaders,
    onMappingChange,
    initialMapping = {},
    projectId
}) => {
    // 1. Get all headers and filter out Project headers if we are in a project context
    const systemHeaders = React.useMemo(() => {
        try {
            let headers = getAllExpectedHeaders(importType);
            // Ensure headers is an array
            if (!Array.isArray(headers)) {
                console.error('getAllExpectedHeaders did not return an array for importType:', importType);
                return [];
            }
            if (projectId !== undefined && projectId !== null && importType !== 'recurring_tasks') {
                // Project Name and Project ID are inherited in project context (except for recurring tasks)
                headers = headers.filter(h =>
                    !['Project Name', 'Project', 'projectName', 'Project ID', 'projectId'].includes(h)
                );
            }
            return headers;
        } catch (error) {
            console.error('Error getting expected headers:', error);
            return [];
        }
    }, [importType, projectId]);

    // Dynamically determine required headers based on context
    const requiredHeaders = React.useMemo(() => {
        try {
            let required = getRequiredHeaders(importType);
            // Ensure required is an array
            if (!Array.isArray(required)) {
                console.error('getRequiredHeaders did not return an array for importType:', importType);
                return [];
            }
            if (projectId !== undefined && projectId !== null && importType !== 'recurring_tasks') {
                // If we are in a project context, Project Name is NOT mandatory for mapping (except for recurring tasks)
                required = required.filter(h =>
                    !['Project Name', 'Project', 'projectName', 'Project ID', 'projectId'].includes(h)
                );
            }
            return required;
        } catch (error) {
            console.error('Error getting required headers:', error);
            return [];
        }
    }, [importType, projectId]);

    // mapping state: { [systemHeader]: excelHeader }
    const [mapping, setMapping] = useState<Record<string, string>>(initialMapping);

    // Auto-map based on exact or fuzzy match initially
    useEffect(() => {
        if (Object.keys(initialMapping).length === 0) {
            const autoMap: Record<string, string> = {};
            // Ensure excelHeaders is an array before spreading
            const availableExcelHeaders = Array.isArray(excelHeaders) ? [...excelHeaders] : [];
            
            // Ensure systemHeaders is an array before forEach
            if (Array.isArray(systemHeaders) && systemHeaders.length > 0) {
                systemHeaders.forEach(sh => {
                    const matchIndex = availableExcelHeaders.findIndex(eh =>
                        eh && typeof eh === 'string' && sh && typeof sh === 'string' &&
                        eh.toLowerCase().trim() === sh.toLowerCase().trim()
                    );

                    if (matchIndex !== -1) {
                        const match = availableExcelHeaders[matchIndex] as string;
                        autoMap[sh] = match;
                        // Remove from available to prevent duplicate auto-mapping
                        availableExcelHeaders.splice(matchIndex, 1);
                    }
                });
            }
            setMapping(autoMap);
            onMappingChange(autoMap);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [importType, excelHeaders, systemHeaders]);

    const handleSelect = (systemHeader: string, excelHeader: string) => {
        const newMapping = { ...mapping, [systemHeader]: excelHeader };
        if (excelHeader === "__unmapped__") {
            delete newMapping[systemHeader];
        }
        setMapping(newMapping);
        onMappingChange(newMapping);
    };

    const isMapped = (systemHeader: string) => !!mapping[systemHeader];
    const isRequiredMatch = (systemHeader: string) => requiredHeaders.includes(systemHeader);

    // Get list of Excel columns already used in OTHER system fields
    const getUsedColumns = (currentSystemHeader: string) => {
        return Object.entries(mapping)
            .filter(([sh, eh]) => sh !== currentSystemHeader && eh !== "__unmapped__")
            .map(([_, eh]) => eh);
    };

    return (
        <div className="flex flex-col gap-6 p-6 overflow-auto">
            <div className="flex flex-col gap-2">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-primary" />
                    Map Your Columns
                </h3>
                <p className="text-sm text-muted-foreground">
                    Connect the columns from your Excel file to the system fields. Required fields must be mapped to proceed.
                </p>
                {projectId && importType !== 'recurring_tasks' && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 text-xs font-medium">
                        <Info className="w-4 h-4" />
                        Project context detected: Project Name will be inherited from the current project.
                    </div>
                )}
                {projectId && importType === 'recurring_tasks' && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-amber-700 text-xs font-medium">
                        <Info className="w-4 h-4" />
                        Multi-project import: Even within a project, you must map the Project Name column for recurring tasks.
                    </div>
                )}
            </div>

            <div className="border rounded-xl overflow-hidden bg-background shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[300px]">System Field</TableHead>
                            <TableHead className="w-[100px]">Status</TableHead>
                            <TableHead>Your Excel Column</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.isArray(systemHeaders) && systemHeaders.length > 0 ? systemHeaders.map((sh) => {
                            const usedColumns = getUsedColumns(sh);
                            return (
                                <TableRow key={sh} className={isMapped(sh) ? "" : "bg-muted/5"}>
                                    <TableCell className="font-medium py-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                {sh}
                                                {isRequiredMatch(sh) && (
                                                    <span className="text-rose-500 text-xs font-bold leading-none transform translate-y-[-2px]">*</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground font-normal">
                                                {isRequiredMatch(sh) ? "Mandatory field" : "Optional field"}
                                            </p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {isMapped(sh) ? (
                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 pr-2">
                                                <CheckCircle2 className="w-3 h-3" /> Mapped
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className={isRequiredMatch(sh) ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-50 text-slate-500 border-slate-200"}>
                                                {isRequiredMatch(sh) ? "Required" : "Unmapped"}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            value={mapping[sh] || "__unmapped__"}
                                            onValueChange={(val) => handleSelect(sh, val)}
                                        >
                                            <SelectTrigger className={cn(
                                                "w-full max-w-md",
                                                !isMapped(sh) && isRequiredMatch(sh) ? "border-rose-300 ring-rose-200" : ""
                                            )}>
                                                <SelectValue placeholder="Select column..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__unmapped__" className="text-muted-foreground italic">
                                                    Do not import
                                                </SelectItem>
                                                {Array.isArray(excelHeaders) && excelHeaders.length > 0 ? excelHeaders.map(eh => {
                                                    const isUsed = usedColumns.includes(eh);
                                                    return (
                                                        <SelectItem
                                                            key={eh}
                                                            value={eh}
                                                            disabled={isUsed}
                                                            className={isUsed ? "opacity-50 grayscale" : ""}
                                                        >
                                                            <div className="flex items-center justify-between w-full gap-4">
                                                                <span>{eh}</span>
                                                                {isUsed && (
                                                                    <Badge variant="outline" className="text-[10px] h-4 py-0 border-muted-foreground/30 text-muted-foreground">
                                                                        Already mapped
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </SelectItem>
                                                    );
                                                }) : (
                                                    <SelectItem value="__no_headers__" disabled>
                                                        No Excel columns available
                                                    </SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                </TableRow>
                            );
                        }) : (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                    No system fields available for this import type.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {requiredHeaders.some(rh => !isMapped(rh)) && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-800 animate-in fade-in slide-in-from-top-2">
                    <Info className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">
                        Please map all required fields (<span className="text-rose-600 font-bold">*</span>) to continue.
                    </p>
                </div>
            )}
        </div>
    );
};

// Utility to merge cn
function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}

