"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    FileUp,
    Table as TableIcon,
    CheckCircle,
    ArrowRight,
    ArrowLeft,
    X,
    Loader2,
    FileSpreadsheet,
    AlertCircle,
    RefreshCw,
    Clock,
    Settings2
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    ImportType,
    ImportStep,
    PreValidationResult,
    SpecificValidationResult,
    ImportContext,
    ValidatedRow,
    getRequiredHeaders
} from "@/lib/services/import/types/import-types";
import { ImportJob } from "@/lib/services/import/types/import-job-types";
import { ImportJobService } from "@/lib/services/import/import-job-service";
import { PreValidationService } from "@/lib/services/import/pre-validation-service";
import { SpecificValidationService } from "@/lib/services/import/specific-validation-service"; // Keep for client-side edit validation
import { VirtualImportReviewTable } from "./review/VirtualImportReviewTable"; // NEW
import { CellResolutionModal } from "./review/CellResolutionModal";
import { ColumnMapper } from "./mapping/ColumnMapper";
import { TemplateDownloadService } from "@/lib/services/import/template-download-service";
import { useDropzone } from 'react-dropzone';
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { useCompany } from '@/contexts/CompanyContext';

interface ImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    importType: ImportType;
    context: ImportContext;
    onImported?: (count: number) => void;
}

export const ImportWizard: React.FC<ImportWizardProps> = ({
    isOpen,
    onClose,
    importType,
    context,
    onImported
}) => {
    // Stage Management
    const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    // Data State
    const [file, setFile] = useState<File | null>(null);
    const [rows, setRows] = useState<ValidatedRow[]>([]);
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);

    // Server-Side Job State
    const [currentJob, setCurrentJob] = useState<ImportJob | null>(null);
    const [jobSubscription, setJobSubscription] = useState<(() => void) | null>(null);

    // Validation State
    const [preValidation, setPreValidation] = useState<PreValidationResult | null>(null);
    const [importedCount, setImportedCount] = useState(0);

    // Timeout & Retry State
    const [validationTimeout, setValidationTimeout] = useState(false);
    const validationStartTime = useRef<number | null>(null);

    const { user } = useAuthStore();
    const [resolutionTarget, setResolutionTarget] = useState<{
        rowNumber: number;
        field: string;
        value: any;
        message?: any;
    } | null>(null);

    const { groupId } = useCompany();

    // 1. Reset only when explicitly requested (removed reset on Dialog closure to persist state for accidental closes)
    // Removed: useEffect(() => { if (!isOpen) handleReset(); }, [isOpen]);

    // Clean up subscription on unmount
    useEffect(() => {
        return () => {
            if (jobSubscription) jobSubscription();
        };
    }, []);

    // Validation timeout detection (5 minutes)
    useEffect(() => {
        if (currentJob?.status === 'validating') {
            if (!validationStartTime.current) {
                validationStartTime.current = Date.now();
            }
            const timeout = setTimeout(() => {
                const elapsed = Date.now() - (validationStartTime.current || Date.now());
                if (elapsed > 5 * 60 * 1000 && currentJob?.status === 'validating') {
                    setValidationTimeout(true);
                }
            }, 5 * 60 * 1000); // 5 minutes
            return () => clearTimeout(timeout);
        } else {
            validationStartTime.current = null;
            setValidationTimeout(false);
        }
    }, [currentJob?.status]);

    // Debug logging for groupId resolution
    useEffect(() => {
        if (isOpen) {
            console.log('[ImportWizard] Context Debug:', {
                groupId,
                companyId: context.companyId,
                projectId: context.projectId,
                authGroupId: user?.enterpriseGroupId
            });
        }
    }, [isOpen, groupId]);

    // -------------------------------------------------------------------------
    // STEP 1: UPLOAD & PRE-CHECK
    // -------------------------------------------------------------------------
    const onDrop = async (acceptedFiles: File[]) => {
        const selectedFile = acceptedFiles[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setError(null);
        setIsLoading(true);
        setLoadingMessage('Checking file structure...');

        try {
            // Client-Side Pre-Check for Headers/Mapping
            // We do this client-side to allow Mapping UI before uploading to server
            const result = await PreValidationService.preValidate(selectedFile, importType, context.projectId);
            setPreValidation(result);

            if (result.success) {
                // FORCE MAPPING step as requested by user ("dont directly go to review")
                // Even if it's a perfect match, show mapping for confirmation
                const matched = Array.isArray(result.headerValidation?.matched) ? result.headerValidation.matched : [];
                const extra = Array.isArray(result.headerValidation?.extra) ? result.headerValidation.extra : [];
                setExcelHeaders([...matched, ...extra]);
                setCurrentStep('column_mapping');
                setIsLoading(false);
            } else {
                // Determine if we should go to MAPPING or show ERROR
                // If headers are missing, always offer MAPPING first
                if (result.headerValidation?.missing && Array.isArray(result.headerValidation.missing) && result.headerValidation.missing.length > 0) {
                    const matched = Array.isArray(result.headerValidation?.matched) ? result.headerValidation.matched : [];
                    const extra = Array.isArray(result.headerValidation?.extra) ? result.headerValidation.extra : [];
                    setExcelHeaders([...matched, ...extra]);
                    setCurrentStep('column_mapping');
                    setIsLoading(false);
                } else {
                    // No headers missing? Then it's actual invalid data in the rows
                    // Since success is false, there must be something blocking.
                    setError("File has inconsistencies or missing values. Please fix and re-upload, or check mapping.");
                    setIsLoading(false);
                }
            }
        } catch (err: any) {
            console.error("Pre-validation check failed", err);
            setError(err.message || "Failed to validate file");
            setIsLoading(false);
        }
    };

    // -------------------------------------------------------------------------
    // STEP 2: START SERVER JOB
    // -------------------------------------------------------------------------
    const startServerJob = async (targetFile: File, mapping: Record<string, string> | null) => {
        // Defensive groupId resolution
        const finalGroupId = groupId || user?.enterpriseGroupId || undefined;

        if (!user || !context.companyId) {
            setError("Missing user context");
            setIsLoading(false);
            return;
        }

        // Strictly enforce groupId for enterprise users to prevent legacy path fallback
        if (!finalGroupId && (user?.enterpriseGroupId || groupId)) {
            console.error('[ImportWizard] Group ID not resolved yet. Aborting job creation.');
            setError("Authentication context is still loading. Please wait a moment and try again.");
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Uploading file to server...');

        console.log('[ImportWizard] Starting job with Group ID:', finalGroupId);

        try {
            const jobId = await ImportJobService.createJob(targetFile, {
                companyId: context.companyId,
                userId: user.id,
                userName: user.name || 'Unknown',
                projectId: context.projectId,
                workspaceId: context.workspaceId,
                importType: importType,
                fileName: targetFile.name,
                fileSize: targetFile.size,
                columnMapping: mapping || null,
                groupId: finalGroupId
            });

            // Subscribe to Job
            const unsubscribe = ImportJobService.subscribeToJob(context.companyId, jobId, handleJobUpdate, finalGroupId);
            if (jobSubscription) jobSubscription(); // Clear old
            setJobSubscription(() => unsubscribe);

        } catch (err: any) {
            console.error("Failed to create job", err);
            setError(err.message || "Failed to start import job");
            setIsLoading(false);
        }
    };

    // -------------------------------------------------------------------------
    // STEP 3: HANDLE JOB UPDATES (POLLING/PUSH)
    // -------------------------------------------------------------------------
    const handleJobUpdate = async (job: ImportJob | null) => {
        if (!job) return;
        setCurrentJob(job);

        // State Machine
        switch (job.status) {
            case 'uploaded':
                setLoadingMessage('Waiting for validation to start...');
                break;
            case 'validating':
                setLoadingMessage('Validating data on server (this make take a moment)...');
                break;
            case 'review':
                if (currentStep !== 'review') {
                    // Fetch results
                    setLoadingMessage('Downloading validation results...');
                    const finalGroupId = groupId || user?.enterpriseGroupId || undefined;

                    console.log('[ImportWizard] Fetching results with Group ID:', finalGroupId);

                    try {
                        const validatedRows = await ImportJobService.getValidationResults(job.companyId, job.id, finalGroupId);
                        setRows(validatedRows);
                        setCurrentStep('review');
                    } catch (err: any) {
                        console.error("Failed to load results", err);
                        setError(`Failed to load validation results: ${err.message || "Unauthorized"}`);
                    } finally {
                        setIsLoading(false);
                    }
                }
                break;
            case 'failed':
                setIsLoading(false);
                if (job.error) {
                    setError(`Import Failed: ${job.error.message}`);
                } else {
                    setError("Import failed (unknown error)");
                }
                break;
            case 'importing':
                setIsLoading(true);
                setLoadingMessage('Executing import...');
                break;
            case 'completed':
                if (currentStep !== 'complete') {
                    setImportedCount(job.stats.importedCount);
                    setCurrentStep('complete');
                    setIsLoading(false); // Move inside to prevent flicker during transition

                    // Dispatch event
                    window.dispatchEvent(new CustomEvent('taskCreated', {
                        detail: { count: job.stats.importedCount, companyId: job.companyId }
                    }));

                    // Auto-reset after a short delay so user can import another file without manual reset
                    setTimeout(() => {
                        handleReset();
                    }, 5000);
                }
                break;
        }
    };

    // -------------------------------------------------------------------------
    // MAPPING CONFIRM
    // -------------------------------------------------------------------------
    const handleMappingConfirm = () => {
        // Validate that all required headers are mapped
        let required = getRequiredHeaders(importType);
        if (context.projectId && importType !== 'recurring_tasks') {
            required = required.filter(h =>
                !['Project Name', 'Project', 'projectName', 'Project ID', 'projectId'].includes(h)
            );
        }

        const missing = required.filter(h => !columnMapping[h]);

        if (missing.length > 0) {
            setError(`Please map the following mandatory fields: ${missing.join(', ')}`);
            return;
        }

        if (file) {
            setError(null);
            startServerJob(file, columnMapping);
        }
    };

    // -------------------------------------------------------------------------
    // STEP 4: REVIEW & EDIT
    // -------------------------------------------------------------------------
    // Client-side quick edit
    const handleCellUpdate = async (rowNumber: number, field: string, newValue: any) => {
        // 1. Update local state immediately for responsiveness
        const updatedRows = rows.map(r => {
            if (r.rowNumber === rowNumber) {
                return {
                    ...r,
                    data: { ...r.data, [field]: newValue }
                };
            }
            return r;
        });
        setRows(updatedRows);

        // 2. Re-validate client-side to update error messages
        try {
            const normalizedField = field.toLowerCase().replace(/ /g, '');
            const isTaskName = ['taskname', 'tasktitle'].includes(normalizedField);

            // For WBS, row changes can affect other rows (predecessors).
            // Also if Task Name changes, it affects anything pointing to it.
            if (importType === 'wbs_gantt' || isTaskName) {
                // Re-validate EVERYTHING for full consistency
                const rawData = updatedRows.map(r => r.data);
                const result = await SpecificValidationService.validate(
                    rawData,
                    importType,
                    {
                        companyId: context.companyId,
                        projectId: context.projectId,
                        workspaceId: context.workspaceId,
                        userId: user?.id || ''
                    },
                    2 // Reset start row number context
                );
                setRows(result.rows as ValidatedRow[]);
            } else {
                // High-performance single row validation for standard fields
                const rowToUpdate = updatedRows.find(r => r.rowNumber === rowNumber);
                if (rowToUpdate) {
                    const allBatchTitles = updatedRows.map(r =>
                        (r.data['Task Name'] || r.data['taskName'] || r.data['Task Title'] || r.data['taskTitle'] || '').trim()
                    ).filter(t => !!t);

                    const result = await SpecificValidationService.validate(
                        [rowToUpdate.data],
                        importType,
                        {
                            companyId: context.companyId,
                            projectId: context.projectId,
                            workspaceId: context.workspaceId,
                            userId: user?.id || ''
                        },
                        rowNumber,
                        allBatchTitles
                    );

                    if (result.rows.length > 0) {
                        const validatedRow = result.rows[0] as ValidatedRow;
                        setRows(prev => prev.map(r => r.rowNumber === rowNumber ? validatedRow : r));
                    }
                }
            }
        } catch (err) {
            console.error("Local validation failed", err);
        }

    };

    // -------------------------------------------------------------------------
    // STEP 5: EXECUTE
    // -------------------------------------------------------------------------
    const handleConfirmImport = async () => {
        if (!currentJob) return;

        setIsLoading(true);
        setLoadingMessage('Starting import execution...');
        try {
            await ImportJobService.executeImport(currentJob.companyId, currentJob.id, rows, groupId || undefined);
            // We set currentStep to review or just keep it there while loading?
            // Actually, stay in review with a loader until 'completed' comes back.
        } catch (err: any) {
            setError(err.message || "Failed to execute import");
            setIsLoading(false);
        }
    };

    // -------------------------------------------------------------------------
    // RETRY & RESET HANDLERS
    // -------------------------------------------------------------------------
    const handleRetry = () => {
        // Clear error states and restart with the same file
        setError(null);
        setValidationTimeout(false);
        setCurrentJob(null);
        if (jobSubscription) {
            jobSubscription();
            setJobSubscription(null);
        }
        if (file) {
            startServerJob(file, Object.keys(columnMapping).length > 0 ? columnMapping : null);
        }
    };

    const handleReset = () => {
        // Full reset - go back to upload step
        setError(null);
        setValidationTimeout(false);
        setIsLoading(false);
        setFile(null);
        setRows([]);
        setColumnMapping({});
        setExcelHeaders([]);
        setCurrentJob(null);
        setPreValidation(null);
        if (jobSubscription) {
            jobSubscription();
            setJobSubscription(null);
        }
        setCurrentStep('upload');
    };

    // -------------------------------------------------------------------------
    // CELL RESOLUTION HANDLER
    // -------------------------------------------------------------------------
    const handleCellResolution = (newValue: any) => {
        if (resolutionTarget) {
            handleCellUpdate(resolutionTarget.rowNumber, resolutionTarget.field, newValue);
            setResolutionTarget(null);
        }
    };

    // -------------------------------------------------------------------------
    // HELPERS
    // -------------------------------------------------------------------------
    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xlsm'],
            'application/vnd.ms-excel': ['.xls', '.xlsx', '.xlsb'],
            'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
            'text/csv': ['.csv'],
            'application/csv': ['.csv'],
            'text/x-csv': ['.csv'],
            'application/x-csv': ['.csv']
        },
        multiple: false,
        noClick: true // We will handle click explicitly to ensure it works across all browsers
    });

    const getStepColor = (step: ImportStep) => {
        const steps: ImportStep[] = ['upload', 'column_mapping', 'review', 'complete'];
        const currentIndex = steps.indexOf(currentStep);
        const stepIndex = steps.indexOf(step);

        if (stepIndex < currentIndex) return "bg-primary text-primary-foreground";
        if (stepIndex === currentIndex) return "bg-primary/20 text-primary border-2 border-primary ring-4 ring-primary/10";
        return "bg-muted text-muted-foreground";
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && !isLoading && onClose()}>
            <DialogContent
                className="max-w-[95vw] w-[1200px] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl border-none"
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                {/* Wizard Header */}
                <DialogHeader className="flex flex-row items-center justify-between p-6 bg-background border-b z-20">
                    <div className="flex flex-col gap-1">
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            <FileSpreadsheet className="w-6 h-6 text-primary" />
                            Import {importType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </DialogTitle>
                        <DialogDescription className="text-sm">
                            Server-Side Processing Enabled
                        </DialogDescription>
                    </div>
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3">
                            {[
                                { id: 'upload' as ImportStep, label: 'Upload' },
                                { id: 'column_mapping' as ImportStep, label: 'Mapping' },
                                { id: 'review' as ImportStep, label: 'Review' },
                                { id: 'complete' as ImportStep, label: 'Done' }
                            ].map((s, idx, arr) => (
                                <React.Fragment key={s.id}>
                                    <div className="flex flex-col items-center gap-1.5 min-w-[60px]">
                                        <div className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                                            getStepColor(s.id)
                                        )}>
                                            {idx < arr.findIndex(x => x.id === currentStep) ? <CheckCircle className="w-5 h-5" /> : idx + 1}
                                        </div>
                                        <span className={cn(
                                            "text-[10px] font-bold uppercase tracking-widest",
                                            currentStep === s.id ? "text-primary" : "text-muted-foreground"
                                        )}>{s.label}</span>
                                    </div>
                                    {idx < arr.length - 1 && (
                                        <div className="w-12 h-[2px] bg-muted mb-4" />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} disabled={isLoading} className="rounded-full h-10 w-10 hover:bg-muted/80">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </DialogHeader>

                {/* Wizard Content */}
                <div className="flex-1 overflow-hidden relative bg-muted/5">
                    {/* Loading Overlay */}
                    {isLoading && (
                        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-[2px] flex flex-col items-center justify-center gap-6">
                            <div className="relative">
                                {validationTimeout ? (
                                    <Clock className="w-16 h-16 text-amber-500" />
                                ) : (
                                    <>
                                        <Loader2 className="w-16 h-16 text-primary animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-3 h-3 bg-primary rounded-full animate-ping" />
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                {validationTimeout ? (
                                    <>
                                        <p className="text-lg font-bold text-amber-600">Validation Taking Longer Than Expected</p>
                                        <p className="text-sm text-muted-foreground max-w-sm text-center">
                                            The server is still processing your file. You can wait or retry.
                                        </p>
                                        <div className="flex items-center gap-3 mt-4">
                                            <Button variant="outline" onClick={handleReset} className="rounded-lg">
                                                <X className="w-4 h-4 mr-2" /> Cancel
                                            </Button>
                                            <Button onClick={handleRetry} className="rounded-lg shadow-lg">
                                                <RefreshCw className="w-4 h-4 mr-2" /> Retry
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-lg font-bold animate-pulse">{loadingMessage || 'Processing...'}</p>
                                        <p className="text-sm text-muted-foreground">Please do not close this window</p>
                                    </>
                                )}
                                {currentJob && (
                                    <Badge variant="outline" className="mt-2 font-mono">Job ID: {currentJob.id}</Badge>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Error Overlay */}
                    {error && !isLoading && currentStep !== 'upload' && (
                        <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center gap-6 p-8">
                            <div className="w-20 h-20 rounded-full bg-rose-100 flex items-center justify-center">
                                <AlertCircle className="w-10 h-10 text-rose-600" />
                            </div>
                            <div className="flex flex-col items-center gap-2 text-center max-w-md">
                                <p className="text-xl font-bold text-rose-700">Import Failed</p>
                                <p className="text-sm text-muted-foreground">{error}</p>
                                {currentJob && (
                                    <Badge variant="outline" className="mt-2 font-mono">Job ID: {currentJob.id}</Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-3 mt-4">
                                <Button variant="outline" onClick={handleReset} className="rounded-lg">
                                    <X className="w-4 h-4 mr-2" /> Start Over
                                </Button>
                                <Button onClick={handleRetry} className="rounded-lg shadow-lg">
                                    <RefreshCw className="w-4 h-4 mr-2" /> Retry
                                </Button>
                            </div>
                        </div>
                    )}

                    {currentStep === 'upload' && (
                        <div className="h-full flex flex-col items-center justify-center p-12 gap-8">
                            <div
                                {...getRootProps()}
                                onClick={() => open()}
                                className={cn(
                                    "w-full max-w-2xl aspect-[16/9] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-6 cursor-pointer transition-all duration-300 group shadow-sm bg-background",
                                    isDragActive ? "border-primary bg-primary/5 scale-[1.02]" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/10",
                                    error ? "border-rose-400 bg-rose-50/20" : ""
                                )}
                            >
                                <input {...getInputProps()} />
                                <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
                                    <FileUp className={cn("w-10 h-10 transition-all duration-300", isDragActive ? "text-primary scale-110" : "text-muted-foreground group-hover:text-primary")} />
                                </div>
                                <div className="text-center space-y-2">
                                    <h3 className="text-xl font-bold">Click or drag file to upload</h3>
                                    <p className="text-sm text-muted-foreground max-w-sm">
                                        Support for Excel (.xlsx) and CSV files. Large files (5000+ rows) supported.
                                    </p>
                                </div>
                            </div>

                            {error && (
                                <div className="mt-8 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 max-w-2xl w-full text-rose-800 animate-in fade-in slide-in-from-top-4">
                                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                                    <div className="text-sm">
                                        <p className="font-bold">Error</p>
                                        <p className="opacity-90">{error}</p>
                                        {(error.includes('Missing headers') || error.includes('structure validation')) && (
                                            <Button
                                                variant="link"
                                                className="p-0 h-auto text-rose-800 font-bold underline mt-2 flex items-center gap-1"
                                                onClick={() => {
                                                    // Derive headers from previous pre-validation if available
                                                    if (preValidation) {
                                                        setExcelHeaders(preValidation.headerValidation.matched.concat(preValidation.headerValidation.extra));
                                                    }
                                                    setCurrentStep('column_mapping');
                                                    setError(null);
                                                }}
                                            >
                                                <Settings2 className="w-3.5 h-3.5" />
                                                Fix Column Mapping Manually
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="mt-12 flex flex-col items-center gap-4">
                                <Button
                                    variant="outline"
                                    className="rounded-full shadow-sm"
                                    onClick={() => TemplateDownloadService.downloadTemplate(importType, { excludeProjectName: !!context.projectId && importType !== 'recurring_tasks' })}
                                >
                                    Download Sample Template
                                </Button>
                            </div>
                        </div>
                    )}

                    {currentStep === 'column_mapping' && (
                        <div className="h-full flex flex-col p-6 animate-in fade-in duration-500">
                            <div className="flex items-center justify-between mb-4 px-2">
                                <div className="flex flex-col">
                                    <h3 className="text-lg font-bold">Column Mapping</h3>
                                    <p className="text-xs text-muted-foreground">Map your file columns to system fields.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" onClick={() => setCurrentStep('upload')} className="rounded-lg">
                                        Back
                                    </Button>
                                    <Button
                                        className="rounded-lg shadow-lg shadow-primary/20"
                                        onClick={handleMappingConfirm}
                                    >
                                        Next: Upload & Validate <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto border rounded-xl bg-background/50 backdrop-blur-sm">
                                <ColumnMapper
                                    importType={importType}
                                    excelHeaders={excelHeaders}
                                    onMappingChange={setColumnMapping}
                                    initialMapping={columnMapping}
                                    projectId={context.projectId}
                                />
                            </div>
                        </div>
                    )}

                    {currentStep === 'review' && (
                        <div className="h-full flex flex-col p-6 animate-in fade-in duration-500">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex flex-col">
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <TableIcon className="w-5 h-5 text-primary" />
                                        Review Server Validation
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Review the data validated by the server. Edit cells to fix errors.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setCurrentStep('column_mapping')}
                                        className="rounded-lg text-muted-foreground group"
                                    >
                                        <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" /> Back to Mapping
                                    </Button>
                                    <Button
                                        className="rounded-lg shadow-lg shadow-primary/20"
                                        disabled={rows.some(r => r.status === 'error') || isLoading}
                                        onClick={handleConfirmImport}
                                    >
                                        {rows.some(r => r.status === 'error')
                                            ? `Confirm Import (${rows.filter(r => r.status === 'error').length} rows have errors)`
                                            : `Confirm Import (${rows.filter(r => r.status === 'success').length} rows valid)`
                                        } <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 bg-background rounded-xl border shadow-sm flex flex-col">
                                {rows.some(r => r.status === 'error') && (
                                    <div className="p-3 bg-rose-50 border-b border-rose-100 text-rose-800 text-xs font-medium flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        Please resolve all rows marked in red before confirming import.
                                    </div>
                                )}
                                <div className="flex-1 min-h-0">
                                    <VirtualImportReviewTable
                                        rows={rows}
                                        headers={rows.length > 0 && rows[0]?.data ? Object.keys(rows[0].data) : (preValidation?.headerValidation.matched || [])}
                                        onRowUpdate={handleCellUpdate}
                                        onRowResolve={(rowNumber, field, value, message) => {
                                            setResolutionTarget({ rowNumber, field, value, message: message ? { field: '', message, severity: 'error' } : undefined });
                                        }}
                                        companyId={context.companyId}
                                        workspaceId={context.workspaceId}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 'complete' && (
                        <div className="h-full flex flex-col items-center justify-center animate-in zoom-in duration-500">
                            <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
                                <CheckCircle className="w-12 h-12 text-emerald-600" />
                            </div>
                            <h2 className="text-3xl font-bold mb-2">Import Job Completed!</h2>
                            <p className="text-muted-foreground mb-8 text-center max-w-sm">
                                {importedCount} items have been processed successfully.
                            </p>
                            <div className="flex flex-col items-center gap-3">
                                <Button onClick={() => { handleReset(); onClose(); }} className="rounded-xl h-12 px-12 bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 font-bold">
                                    Done & Close
                                </Button>
                                <Button variant="ghost" onClick={handleReset} className="text-muted-foreground font-medium hover:text-primary transition-colors">
                                    Import Another File
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>

            {/* Cell Resolution Modal */}
            {
                resolutionTarget && (
                    <CellResolutionModal
                        isOpen={true}
                        onClose={() => setResolutionTarget(null)}
                        onResolve={handleCellResolution}
                        fieldName={resolutionTarget.field}
                        currentValue={resolutionTarget.value}
                        message={resolutionTarget.message}
                        companyId={context.companyId}
                        projectId={context.projectId}
                        workspaceId={context.workspaceId}
                    />
                )
            }
        </Dialog >
    );
};
