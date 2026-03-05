'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { TaskRequestPriority } from '@/types/task-request-schema';
import { WorkspaceService } from '@/lib/services';
import { TaskRequestService } from '@/lib/services/task-requests/task-request-service';
import type { Workspace } from '@/types/workspace-schema';
import { Send, Loader2, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCompany } from '@/contexts/CompanyContext';

interface TaskRequestDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fromWorkspace: Workspace;
    companyId: string;
    currentUser: { id: string; name: string };
}

export function TaskRequestDialog({
    open,
    onOpenChange,
    fromWorkspace,
    companyId: _companyId,
    currentUser,
}: TaskRequestDialogProps) {
    const { groupId, companyId } = useCompany();
    const [loading, setLoading] = useState(false);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [fetchingWorkspaces, setFetchingWorkspaces] = useState(false);

    // Form State
    const [targetWorkspaceId, setTargetWorkspaceId] = useState<string>('');
    const [priority, setPriority] = useState<TaskRequestPriority>('medium');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (open && companyId && groupId) {
            loadOtherWorkspaces();
        }
    }, [open, companyId, groupId]);

    const loadOtherWorkspaces = async () => {
        try {
            setFetchingWorkspaces(true);
            const all = await WorkspaceService.getWorkspaces((groupId || companyId)!, companyId!, { status: 'active' });
            // Filter out current workspace
            setWorkspaces(all.filter(w => w.id !== fromWorkspace.id));
        } catch (error) {
            console.error('Failed to load target workspaces:', error);
            toast.error('Could not load target workspaces');
        } finally {
            setFetchingWorkspaces(false);
        }
    };

    const handleSend = async () => {
        if (!targetWorkspaceId) {
            toast.error('Please select a target workspace');
            return;
        }
        if (!message.trim()) {
            toast.error('Please provide a message for the request');
            return;
        }

        const targetWS = workspaces.find(w => w.id === targetWorkspaceId);

        try {
            setLoading(true);
            await TaskRequestService.createRequest({
                companyId: companyId!,
                groupId: (groupId || companyId)!,
                fromWorkspaceId: fromWorkspace.id,
                fromWorkspaceName: fromWorkspace.name,
                toWorkspaceId: targetWorkspaceId,
                toWorkspaceName: targetWS?.name || 'Target Workspace',
                requesterId: currentUser.id,
                requesterName: currentUser.name,
                message,
                priority,
            });

            toast.success('Task request sent successfully!');
            onOpenChange(false);
            // Reset form
            setTargetWorkspaceId('');
            setMessage('');
            setPriority('medium');
        } catch (error) {
            console.error('Failed to send task request:', error);
            toast.error('Failed to send task request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Send className="w-5 h-5 text-primary" />
                        Send Task Request
                    </DialogTitle>
                    <DialogDescription>
                        Request task creation from another workspace. They will be notified to accept and manually create the task.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-3">
                        <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                        <p className="text-xs text-blue-700">
                            <strong>From:</strong> {fromWorkspace.name}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="target-workspace">Target Workspace</Label>
                        <Select
                            disabled={fetchingWorkspaces || loading}
                            value={targetWorkspaceId}
                            onValueChange={setTargetWorkspaceId}
                        >
                            <SelectTrigger id="target-workspace">
                                <SelectValue placeholder={fetchingWorkspaces ? "Loading workspaces..." : "Select target workspace"} />
                            </SelectTrigger>
                            <SelectContent>
                                {workspaces.map((ws) => (
                                    <SelectItem key={ws.id} value={ws.id}>
                                        {ws.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="priority">Priority</Label>
                        <Select
                            disabled={loading}
                            value={priority}
                            onValueChange={(v) => setPriority(v as TaskRequestPriority)}
                        >
                            <SelectTrigger id="priority">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="message">Detailed Information</Label>
                        <Textarea
                            id="message"
                            placeholder="Type the detailed info for the task you want them to create..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="min-h-[120px] resize-none"
                            disabled={loading}
                        />
                        <p className="text-[10px] text-muted-foreground text-right">
                            Characters: {message.length}
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSend} disabled={loading || fetchingWorkspaces}>
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4 mr-2" />
                                Send Request
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
