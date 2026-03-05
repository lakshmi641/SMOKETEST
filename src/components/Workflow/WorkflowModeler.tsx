import React, { useState, useEffect } from 'react';
import { WorkflowDefinition } from '../../types/workflow-schema';
import { WorkflowService } from '../../lib/services/workflow-service';
import { useAuthStore } from '../../store/authStore';
import { useCompany } from '@/contexts/CompanyContext';
import { BPMNModeler } from './BPMNModeler';
import { getActiveApprovalLines } from '../../lib/services/approval-line-service';
import { getActiveEscalationPaths } from '../../lib/services/escalation-path-service';
import { ApprovalLine, EscalationPath } from '../../types/approval-line-schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    ShieldCheck,
    TrendingUp,
    Save,
    Zap,
    Play,
    AlertCircle,
    Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface WorkflowModelerProps {
    initialWorkflow?: WorkflowDefinition;
    onSave: (workflow: WorkflowDefinition) => Promise<string | void>;
}

export function WorkflowModeler({ initialWorkflow, onSave }: WorkflowModelerProps) {
    const { user } = useAuthStore();
    const { companyId, groupId } = useCompany();
    const [workflow, setWorkflow] = useState<WorkflowDefinition>(initialWorkflow || {
        id: '',
        companyId: user?.companyId || '',
        name: 'New Workflow',
        triggerType: 'manual',
        steps: [],
        bpmnXml: '',
        version: 1,
        isDraft: true,
        status: 'draft',
        isDeployed: false,
        isActive: false,
        visibility: 'private',
        allowCopy: true,
        ownerId: user?.id || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user?.id || '',
    });

    const [xml, setXml] = useState<string>(workflow.bpmnXml || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isDeploying, setIsDeploying] = useState(false);
    const [approvalLines, setApprovalLines] = useState<ApprovalLine[]>([]);
    const [escalationPaths, setEscalationPaths] = useState<EscalationPath[]>([]);

    useEffect(() => {
        if (companyId) {
            loadMetaData();
        }
    }, [companyId, groupId]);

    const loadMetaData = async () => {
        if (!companyId) return;
        try {
            const effectiveGroupId = groupId ?? undefined;
            const [lines, paths] = await Promise.all([
                getActiveApprovalLines(companyId, effectiveGroupId),
                getActiveEscalationPaths(companyId, effectiveGroupId)
            ]);
            setApprovalLines(lines);
            setEscalationPaths(paths);
        } catch (error) {
            console.error('Failed to load metadata:', error);
            toast.error('Failed to load configuration options');
        }
    };

    const handleSave = async (): Promise<string | undefined> => {
        try {
            setIsSaving(true);
            const updatedWorkflow = {
                ...workflow,
                companyId: workflow.companyId || user?.companyId || '',
                bpmnXml: xml,
                updatedAt: new Date().toISOString(),
            };

            const resultId = await onSave(updatedWorkflow);

            if (resultId && typeof resultId === 'string') {
                setWorkflow((prev) => ({ ...prev, ...updatedWorkflow, id: resultId }));
                return resultId;
            } else {
                setWorkflow((prev) => ({ ...prev, ...updatedWorkflow }));
                return updatedWorkflow.id;
            }
        } catch (error) {
            console.error('Error saving workflow:', error);
            toast.error('Failed to save workflow');
            return undefined;
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeploy = async () => {
        try {
            setIsDeploying(true);
            const idToDeploy = await handleSave();

            if (!idToDeploy) return;

            if (!user?.companyId) {
                toast.error('User company ID not found');
                return;
            }

            await WorkflowService.deployWorkflow(user.companyId, idToDeploy);
            toast.success(`Deployment triggered successfully`);
        } catch (error: any) {
            console.error('Deployment failed:', error);
            toast.error(`Deployment failed: ${error.message}`);
        } finally {
            setIsDeploying(false);
        }
    };

    const handleTestTrigger = async () => {
        try {
            if (!user?.companyId) {
                toast.error('Company ID not found');
                return;
            }

            const companyId = workflow.companyId || user.companyId;
            const processKey = 'simple-task-process';
            const eventId = await WorkflowService.startProcess(companyId, processKey, 'test-key', {
                initiator: user.email,
                amount: 100
            });
            toast.success(`Triggered! Event ID: ${eventId}`);
        } catch (error: any) {
            toast.error(`Trigger failed: ${error.message}`);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] bg-background border rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-500">
            {/* Glossy Header */}
            <div className="bg-card/50 backdrop-blur-xl border-b px-8 py-5 flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                        <Zap className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                            Workflow Designer
                            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest bg-emerald-500/5 text-emerald-600 border-emerald-500/20">
                                BPMN 2.0
                            </Badge>
                        </h2>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-tighter opacity-70">Orchestrate enterprise business logic</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="sm" onClick={handleTestTrigger} className="rounded-xl font-bold border-2">
                                    <Play className="w-3.5 h-3.5 mr-2 text-primary" />
                                    Simulator
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Run a test instance using generic variables</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <Button onClick={handleSave} disabled={isSaving} variant="secondary" size="sm" className="rounded-xl font-bold border-2">
                        <Save className="w-3.5 h-3.5 mr-2" />
                        {isSaving ? 'Synching...' : 'Commit Draft'}
                    </Button>

                    <Button onClick={handleDeploy} disabled={isDeploying || isSaving} size="sm" className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
                        <Zap className="w-3.5 h-3.5 mr-2" />
                        {isDeploying ? 'Deploying...' : 'Deploy Blueprint'}
                    </Button>
                </div>
            </div>

            {/* Config Control Bar */}
            <div className="bg-accent/10 border-b px-8 py-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Blueprint Name</Label>
                        <Input
                            placeholder="Onboarding Flow..."
                            value={workflow.name}
                            onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
                            className="bg-background/50 border-2 rounded-xl h-10 font-medium focus-visible:ring-primary/20 transition-all"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Logic ID</Label>
                        <div className="bg-accent/20 border-2 border-dashed rounded-xl h-10 px-3 flex items-center text-xs font-mono text-muted-foreground/80">
                            {workflow.id || 'AUTO_GEN_ID'}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                            <ShieldCheck className="w-3 h-3" /> Approval Line
                        </Label>
                        <Select
                            value={workflow.approvalLineId}
                            onValueChange={(val) => setWorkflow({ ...workflow, approvalLineId: val })}
                        >
                            <SelectTrigger className="bg-background/50 border-2 rounded-xl h-10 font-medium">
                                <SelectValue placeholder="Select Master Approval" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="none">None (Direct Execution)</SelectItem>
                                {approvalLines.map(line => (
                                    <SelectItem key={line.id} value={line.id}>
                                        <div className="flex flex-col py-0.5">
                                            <span className="font-bold">{line.name}</span>
                                            <span className="text-[10px] opacity-60 uppercase tracking-tighter">{line.category} • {line.stages.length} Stages</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-1.5">
                            <TrendingUp className="w-3 h-3" /> Escalation Path
                        </Label>
                        <Select
                            value={workflow.escalationPathId}
                            onValueChange={(val) => setWorkflow({ ...workflow, escalationPathId: val })}
                        >
                            <SelectTrigger className="bg-background/50 border-2 rounded-xl h-10 font-medium">
                                <SelectValue placeholder="Select SLA Policy" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="none">None (No Monitoring)</SelectItem>
                                {escalationPaths.map(path => (
                                    <SelectItem key={path.id} value={path.id}>
                                        <div className="flex flex-col py-0.5">
                                            <span className="font-bold">{path.name}</span>
                                            <span className="text-[10px] opacity-60 uppercase tracking-tighter">{path.category} • {path.rules.length} Rules</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* BPMN Fabric */}
            <div className="relative flex-1 bg-accent/5">
                <BPMNModeler
                    xml={xml}
                    onChange={(newXml) => setXml(newXml)}
                />
            </div>

            {/* Footer Status */}
            <div className="bg-card border-t px-6 py-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1"><Info className="w-3 h-3" /> Last Save: {workflow.updatedAt ? new Date(workflow.updatedAt).toLocaleTimeString() : 'N/A'}</span>
                    <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Build v{workflow.version}.0</span>
                </div>
                <div>Julley Engine Runtime • Stage: Engineering Preview</div>
            </div>
        </div>
    );
}
