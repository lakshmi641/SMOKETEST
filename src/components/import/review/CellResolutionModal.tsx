"use client";

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    AlertCircle,
    AlertTriangle,
    Sparkles,
    Check,
    Search,
    Loader2
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { EntityLookupService } from "@/lib/services/import/entity-lookup-service";
import { CellValidationMessage, CellSuggestion } from "@/lib/services/import/types/import-types";
import { MemberSelect } from "@/components/common/MemberSelect";

interface CellResolutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onResolve: (newValue: any) => void;
    fieldName: string;
    currentValue: any;
    message?: CellValidationMessage;
    companyId?: string;
    projectId?: string;
    workspaceId?: string;
}

export const CellResolutionModal: React.FC<CellResolutionModalProps> = ({
    isOpen,
    onClose,
    onResolve,
    fieldName,
    currentValue,
    message,
    companyId,
    projectId,
    workspaceId
}) => {
    const [value, setValue] = useState(currentValue || '');
    const [options, setOptions] = useState<{ label: string, value: any }[]>([]);
    const [isLoadingOptions, setIsLoadingOptions] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        setValue(currentValue || '');
        if (isOpen) {
            loadOptions();
        }
    }, [currentValue, fieldName, isOpen]);

    const loadOptions = async () => {
        setIsLoadingOptions(true);
        try {
            const normalizedField = fieldName.toLowerCase().replace(/ /g, '');

            // 1. Hardcoded Enums
            if (normalizedField === 'priority') {
                setOptions(['low', 'medium', 'high', 'urgent', 'critical'].map(v => ({
                    label: v.charAt(0).toUpperCase() + v.slice(1),
                    value: v
                })));
            } else if (normalizedField === 'status') {
                setOptions(['open', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled', 'escalated'].map(v => ({
                    label: v.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                    value: v
                })));
            } else if (normalizedField === 'category') {
                setOptions(['onboarding', 'compliance', 'operational', 'project', 'training', 'maintenance', 'custom'].map(v => ({
                    label: v.charAt(0).toUpperCase() + v.slice(1),
                    value: v
                })));
            }
            // 2. Dynamic Lookups
            else if (companyId) {
                if (normalizedField.includes('user') || normalizedField.includes('assigne') || normalizedField.includes('reporte')) {
                    const users = await EntityLookupService.fetchUsers(companyId);
                    setOptions(users.map(u => ({ label: u.name, value: u.name })));
                } else if (normalizedField.includes('department')) {
                    const depts = await EntityLookupService.fetchDepartments(companyId);
                    setOptions(depts.map(d => ({ label: d.name, value: d.name })));
                } else if (normalizedField.includes('team')) {
                    const teams = await EntityLookupService.fetchTeams(companyId);
                    setOptions(teams.map(t => ({ label: t.name, value: t.name })));
                } else if (normalizedField.includes('project')) {
                    const projects = await EntityLookupService.fetchProjects(companyId);
                    setOptions(projects.map(p => ({ label: p.name, value: p.name })));
                } else if (normalizedField.includes('tasktype')) {
                    const taskTypes = await EntityLookupService.fetchTaskTypes(companyId);
                    // Fallback to default task types if database is empty
                    if (taskTypes.length === 0) {
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
                        setOptions(taskTypes.map(tt => ({ label: tt.name, value: tt.name })));
                    }
                } else if (normalizedField.includes('requirementtype')) {
                    const reqTypes = await EntityLookupService.fetchRequirementTypes(companyId);
                    // Fallback to default requirement types if database is empty
                    if (reqTypes.length === 0) {
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
                        setOptions(reqTypes.map(rt => ({ label: rt.name, value: rt.name })));
                    }
                }
            }
        } catch (err) {
            console.error("Failed to load options", err);
        } finally {
            setIsLoadingOptions(false);
        }
    };

    const handleApplySuggestion = (suggestion: CellSuggestion) => {
        setValue(suggestion.label);
    };

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(opt.value).toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
                <DialogHeader className="p-6 bg-background border-b shrink-0">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "p-3 rounded-2xl",
                            message?.severity === 'error' ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                        )}>
                            {message?.severity === 'error' ? <AlertCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold">Resolve {fieldName}</DialogTitle>
                            <DialogDescription className="text-xs">
                                Choose a valid value for this field.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col p-6 gap-6 bg-muted/5">
                    {/* Error Banner */}
                    <div className={cn(
                        "p-4 rounded-2xl text-sm border shadow-sm",
                        message?.severity === 'error' ? "bg-rose-50 border-rose-100 text-rose-700" : "bg-amber-50 border-amber-100 text-amber-700"
                    )}>
                        <p className="font-bold mb-1 flex items-center gap-1.5 uppercase tracking-tight text-[10px]">
                            Issue Details
                        </p>
                        <p className="opacity-90 leading-relaxed font-medium">
                            {message?.message.includes('misspelled') || message?.message.includes('invalid')
                                ? "The value I have provided is not available. Please select a value from the available options."
                                : message?.message}
                        </p>
                    </div>

                    {/* Value Input Area */}
                    {(fieldName.toLowerCase().includes('user') || fieldName.toLowerCase().includes('assigne') || fieldName.toLowerCase().includes('reporte')) && companyId ? (
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                Select Member or Position
                            </Label>
                            <MemberSelect
                                workspaceId={workspaceId}
                                placeholder={`Select ${fieldName}...`}
                                className="w-full"
                                value={value ? {
                                    type: 'user',
                                    id: 'dummy',
                                    label: value
                                } : undefined}
                                onValueChange={(selection) => {
                                    if (selection) {
                                        setValue(selection.label);
                                    }
                                }}
                            />
                            <p className="text-[10px] text-muted-foreground ml-1 leading-relaxed">
                                You can select a specific user or a position (e.g. "Software Engineer"). The system will match it.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                Current Value
                            </Label>
                            <Input
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                className="h-12 rounded-2xl border-muted-foreground/20 focus:ring-primary shadow-sm bg-background font-medium"
                                placeholder={`Enter ${fieldName}...`}
                            />
                        </div>
                    )}

                    {/* Options List */}
                    {options.length > 0 && !(fieldName.toLowerCase().includes('user') || fieldName.toLowerCase().includes('assigne') || fieldName.toLowerCase().includes('reporte')) && (
                        <div className="flex-1 flex flex-col min-h-0 space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center justify-between">
                                Select from Available Options
                                {isLoadingOptions && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                            </Label>

                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Type to filter..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-11 h-10 text-xs rounded-xl bg-background border-muted-foreground/10 focus:ring-primary"
                                />
                            </div>

                            <ScrollArea className="flex-1 border rounded-2xl bg-background shadow-inner">
                                <div className="p-2 space-y-1">
                                    {filteredOptions.length > 0 ? (
                                        filteredOptions.map((opt, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setValue(opt.value)}
                                                className={cn(
                                                    "w-full text-left px-4 py-3 rounded-xl text-sm transition-all flex items-center justify-between group",
                                                    value === opt.value
                                                        ? "bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20"
                                                        : "hover:bg-primary/10 hover:text-primary"
                                                )}
                                            >
                                                <span>{opt.label}</span>
                                                <div className="flex items-center gap-2">
                                                    {opt.value === message?.suggestion?.value && (
                                                        <Badge variant="outline" className={cn(
                                                            "text-[9px] h-5 rounded-full",
                                                            value === opt.value ? "border-primary-foreground/50 text-white" : "border-primary/30 text-primary"
                                                        )}>
                                                            Best Match
                                                        </Badge>
                                                    )}
                                                    {value === opt.value && <Check className="w-4 h-4 animate-in zoom-in duration-300" />}
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                                            <Search className="w-8 h-8 opacity-10" />
                                            <p className="text-xs italic">No results found for your search.</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    )}

                    {!options.length && !isLoadingOptions && message?.suggestion && !(fieldName.toLowerCase().includes('user') || fieldName.toLowerCase().includes('assigne') || fieldName.toLowerCase().includes('reporte')) && (
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-primary" />
                                AI Optimized Match
                            </Label>
                            <Button
                                variant="outline"
                                className="w-full h-auto py-4 px-6 justify-between border-primary/20 bg-primary/[0.03] hover:bg-primary/[0.08] hover:border-primary/40 rounded-2xl group transition-all"
                                onClick={() => handleApplySuggestion(message.suggestion!)}
                            >
                                <div className="flex flex-col items-start gap-1">
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">System Resolution:</span>
                                    <span className="text-base font-bold text-primary">{message.suggestion.label}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-3 font-bold">
                                        {Math.round(message.suggestion.confidence * 100)}% Match
                                    </Badge>
                                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center scale-0 group-hover:scale-100 transition-all duration-300 shadow-xl shadow-primary/30">
                                        <Check className="w-4 h-4 font-black" />
                                    </div>
                                </div>
                            </Button>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 bg-muted/30 border-t flex sm:justify-between items-center gap-4 shrink-0">
                    <Button variant="ghost" onClick={onClose} className="rounded-xl h-12 px-8 font-bold text-muted-foreground">
                        Cancel
                    </Button>
                    <Button
                        onClick={() => onResolve(value)}
                        className="rounded-xl h-12 px-10 font-bold shadow-xl shadow-primary/25 bg-primary hover:bg-primary/90"
                    >
                        Apply Choice
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
