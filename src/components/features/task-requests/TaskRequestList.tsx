'use client';

import { useCompany } from '@/contexts/CompanyContext';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { TaskRequest, TaskRequestStatus } from '@/types/task-request-schema';
import { TaskRequestService } from '@/lib/services/task-requests/task-request-service';
import { Plus, Inbox, Send, Eye, MessageSquare, Clock, CheckCircle2, XCircle, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
import { TaskRequestDetailDialog } from '@/components/features/task-requests/TaskRequestDetailDialog';

interface TaskRequestListProps {
    workspaceId: string;
    companyId: string;
    currentUser: { id: string; name: string };
    onCreateNew: () => void;
}

export function TaskRequestList({
    workspaceId,
    companyId,
    currentUser,
    onCreateNew,
}: TaskRequestListProps) {
    const { groupId } = useCompany();
    const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
    const [requests, setRequests] = useState<TaskRequest[]>([]);
    const [loading, setLoading] = useState(true);

    // Detail Dialog State
    const [selectedRequest, setSelectedRequest] = useState<TaskRequest | null>(null);

    useEffect(() => {
        setLoading(true);
        const unsubscribe = TaskRequestService.subscribeWorkspaceRequests(
            companyId,
            workspaceId,
            activeTab,
            (data) => {
                setRequests(data);
                setLoading(false);
            },
            groupId || undefined
        );

        return () => unsubscribe();
    }, [companyId, workspaceId, activeTab]);

    const getStatusBadge = (status: TaskRequestStatus) => {
        switch (status) {
            case 'pending':
                return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
            case 'accepted':
                return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Accepted</Badge>;
            case 'task_created':
                return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Task Created</Badge>;
            case 'rejected':
                return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Declined</Badge>;
            case 'archived':
                return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Archived</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case 'urgent':
                return <Badge className="bg-red-600">Urgent</Badge>;
            case 'high':
                return <Badge variant="destructive">High</Badge>;
            case 'medium':
                return <Badge variant="default">Medium</Badge>;
            case 'low':
                return <Badge variant="secondary">Low</Badge>;
            default:
                return <Badge>{priority}</Badge>;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 p-1 bg-muted rounded-lg w-fit">
                    <Button
                        variant={activeTab === 'incoming' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab('incoming')}
                        className="gap-2"
                    >
                        <Inbox className="w-4 h-4" />
                        Received
                    </Button>
                    <Button
                        variant={activeTab === 'outgoing' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab('outgoing')}
                        className="gap-2"
                    >
                        <Send className="w-4 h-4" />
                        Sent
                    </Button>
                </div>

                <Button onClick={onCreateNew} size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    New Request
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        {activeTab === 'incoming' ? <Inbox className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                        {activeTab === 'incoming' ? 'Incoming Task Requests' : 'Your Sent Requests'}
                    </CardTitle>
                    <CardDescription>
                        {activeTab === 'incoming'
                            ? 'Tasks requested by other workspaces from your team.'
                            : 'Requests you have sent to other workspaces for task creation.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                            <h3 className="text-lg font-semibold mb-1">No requests found</h3>
                            <p className="text-sm text-muted-foreground">
                                {activeTab === 'incoming'
                                    ? 'Hooray! No pending requests for your workspace right now.'
                                    : 'You haven\'t sent any task requests yet.'}
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[150px]">Date</TableHead>
                                        <TableHead>{activeTab === 'incoming' ? 'From' : 'To'}</TableHead>
                                        <TableHead>Message Preview</TableHead>
                                        <TableHead>Priority</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {requests.map((request) => (
                                        <TableRow key={request.id}>
                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                {format(new Date(request.createdAt), 'MMM d, h:mm a')}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm">
                                                        {activeTab === 'incoming' ? request.fromWorkspaceName : request.toWorkspaceName}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {activeTab === 'incoming' ? `By ${request.requesterName}` : 'Sent by You'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <p className="text-sm truncate max-w-[300px] text-muted-foreground">
                                                    {request.message}
                                                </p>
                                            </TableCell>
                                            <TableCell>
                                                {getPriorityBadge(request.priority)}
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(request.status)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSelectedRequest(request)}
                                                >
                                                    <Eye className="w-4 h-4 mr-2" />
                                                    View
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <TaskRequestDetailDialog
                open={!!selectedRequest}
                onOpenChange={(open: boolean) => !open && setSelectedRequest(null)}
                request={selectedRequest}
                companyId={companyId}
                currentUser={currentUser}
                type={activeTab}
            />
        </div>
    );
}
