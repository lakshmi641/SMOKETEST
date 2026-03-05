'use client';

import { useCompany } from '@/contexts/CompanyContext';

import React, { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TaskRequest } from '@/types/task-request-schema';
import { TaskRequestService } from '@/lib/services/task-requests/task-request-service';
import {
    CheckCircle2,
    Clock,
    User,
    ArrowRight,
    MessageSquare,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface TaskRequestDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    request: TaskRequest | null;
    companyId: string;
    currentUser: { id: string; name: string };
    type: 'incoming' | 'outgoing';
}

export function TaskRequestDetailDialog({
    open,
    onOpenChange,
    request,
    companyId: _companyId,
    currentUser,
    type,
}: TaskRequestDetailDialogProps) {
    const { groupId, companyId } = useCompany();
    const [loading, setLoading] = useState(false);
    const [replyNote, setReplyNote] = useState('');

    if (!request) return null;

    const isPending = request.status === 'pending';
    const isAccepted = request.status === 'accepted';
    const isIncoming = type === 'incoming';

    const handleAction = async (status: 'accepted' | 'task_created' | 'rejected') => {
        try {
            setLoading(true);
            await TaskRequestService.updateStatus({
                companyId: companyId!,
                groupId: (groupId || companyId)!,
                requestId: request.id,
                status,
                userId: currentUser.id,
                userName: currentUser.name,
                replyNote: replyNote.trim() || undefined,
            });

            const actionLabel = status === 'accepted' ? 'accepted' : status === 'task_created' ? 'completed' : 'declined';
            toast.success(`Request ${actionLabel} successfully!`);
            onOpenChange(false);
            setReplyNote('');
        } catch (error) {
            console.error(`Failed to update request to ${status}:`, error);
            toast.error('Operation failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                            ID: {request.id.slice(0, 8)}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(request.createdAt), 'MMM d, yyyy HH:mm')}
                        </span>
                    </div>
                    <DialogTitle className="text-xl">
                        Task Request Review
                    </DialogTitle>
                    <DialogDescription>
                        {isIncoming
                            ? `Review information sent by ${request.fromWorkspaceName}.`
                            : `Status and details for your request to ${request.toWorkspaceName}.`}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Header Info */}
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border">
                        <div className="text-center flex-1">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">From</p>
                            <p className="text-sm font-semibold">{request.fromWorkspaceName}</p>
                            <p className="text-[10px] text-muted-foreground">{request.requesterName}</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-muted-foreground/30" />
                        <div className="text-center flex-1">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Target</p>
                            <p className="text-sm font-semibold">{request.toWorkspaceName}</p>
                        </div>
                    </div>

                    {/* Detailed Info */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-primary" />
                                Detailed Information
                            </Label>
                            <Badge className={
                                request.priority === 'urgent' ? 'bg-red-600' :
                                    request.priority === 'high' ? 'bg-orange-500' : 'bg-blue-500'
                            }>
                                {request.priority.toUpperCase()} PRIORITY
                            </Badge>
                        </div>
                        <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-lg text-sm leading-relaxed text-blue-900 min-h-[100px] whitespace-pre-wrap">
                            {request.message}
                        </div>
                    </div>

                    {/* Replies / Notes if any */}
                    {request.replyNote && (
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground">Response Note</Label>
                            <div className="p-3 bg-gray-50 border rounded-lg text-xs italic">
                                "{request.replyNote}"
                                <div className="mt-2 text-[10px] font-medium text-right non-italic">
                                    — {request.completedByName || request.acceptedByName}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions Area (Only for Recipients) */}
                    {isIncoming && (isPending || isAccepted) && (
                        <div className="space-y-4 pt-4 border-t">
                            <div className="space-y-2">
                                <Label htmlFor="reply-note" className="text-xs">Add a note (shown to requester)</Label>
                                <Textarea
                                    id="reply-note"
                                    placeholder="Optional note e.g. 'Assigned to team', 'Check project X'..."
                                    value={replyNote}
                                    onChange={(e) => setReplyNote(e.target.value)}
                                    className="h-20 text-sm"
                                    disabled={loading}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {isPending ? (
                                    <>
                                        <Button
                                            variant="outline"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => handleAction('rejected')}
                                            disabled={loading}
                                        >
                                            Decline
                                        </Button>
                                        <Button
                                            className="bg-blue-600 hover:bg-blue-700"
                                            onClick={() => handleAction('accepted')}
                                            disabled={loading}
                                        >
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Accept Request'}
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        className="col-span-2 bg-green-600 hover:bg-green-700 h-12"
                                        onClick={() => handleAction('task_created')}
                                        disabled={loading}
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="w-5 h-5" />
                                                <span>Mark as Task Created</span>
                                            </div>
                                        )}
                                    </Button>
                                )}
                            </div>

                            {isAccepted && (
                                <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Make sure you have manually created the task in your project before marking it as complete.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Status Info for Requesters */}
                    {!isIncoming && (
                        <div className={`p-4 rounded-lg flex items-start gap-3 ${request.status === 'task_created' ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-700'
                            }`}>
                            {request.status === 'task_created' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                            <div className="text-xs">
                                <p className="font-bold">Status: {request.status.replace('_', ' ').toUpperCase()}</p>
                                <p className="opacity-80 mt-1">
                                    {request.status === 'pending' && "Waiting for Workspace B to view and accept."}
                                    {request.status === 'accepted' && `${request.acceptedByName} has accepted your request and is creating the task.`}
                                    {request.status === 'task_created' && `Success! ${request.completedByName} has confirmed the task is created.`}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
