import React, { useState } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Priority } from '@/types/external-notifications';

interface EmailTemplateEditorProps {
    initialData?: {
        subject: string;
        body: string;
        priority: Priority;
    };
    onSave: (data: { subject: string; body: string; priority: Priority }) => void;
    isSaving: boolean;
}

export function EmailTemplateEditor({ initialData, onSave, isSaving }: EmailTemplateEditorProps) {
    const [subject, setSubject] = useState(initialData?.subject || '');
    const [body, setBody] = useState(initialData?.body || '');
    const [priority, setPriority] = useState<Priority>(initialData?.priority || 'medium');
    const [previewMode, setPreviewMode] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ subject, body, priority });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Email Template Design</h3>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setPreviewMode(!previewMode)}
                    >
                        {previewMode ? 'Edit Mode' : 'Preview Mode'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Editor Column */}
                <Card className={previewMode ? 'hidden lg:block' : 'block'}>
                    <CardHeader>
                        <CardTitle>Editor</CardTitle>
                        <CardDescription>Compose your email notification</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="subject">Email Subject</Label>
                                <Input
                                    id="subject"
                                    placeholder="e.g., You have a new task assigned"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    required
                                />
                                <p className="text-xs text-muted-foreground">
                                    Note: Priority prefix (e.g. [HIGH]) will be added automatically.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="priority">Default Priority</Label>
                                <Select
                                    value={priority}
                                    onValueChange={(val: Priority) => setPriority(val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low (Info)</SelectItem>
                                        <SelectItem value="medium">Medium (Standard)</SelectItem>
                                        <SelectItem value="high">High (Important)</SelectItem>
                                        <SelectItem value="urgent">Urgent (Critical)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="body">Email Body (HTML Supported)</Label>
                                <Textarea
                                    id="body"
                                    placeholder="<p>Hello {{userName}},</p><p>You have been mentioned...</p>"
                                    className="min-h-[300px] font-mono text-sm"
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    required
                                />
                                <div className="text-xs text-muted-foreground flex gap-2">
                                    <span>Variables:</span>
                                    <Badge variant="outline">{`{{ userName }}`}</Badge>
                                    <Badge variant="outline">{`{{ taskTitle }}`}</Badge>
                                    <Badge variant="outline">{`{{ actionUrl }}`}</Badge>
                                </div>
                            </div>

                            <Button type="submit" disabled={isSaving} className="w-full">
                                {isSaving ? 'Saving Template...' : 'Save Template'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Preview Column */}
                <Card className={!previewMode ? 'hidden lg:block' : 'block'}>
                    <CardHeader>
                        <CardTitle>Live Preview</CardTitle>
                        <CardDescription>How it will look in the inbox</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-md p-4 space-y-4 bg-white dark:bg-zinc-950">
                            {/* Fake Email Header */}
                            <div className="border-b pb-4 space-y-2">
                                <div className="flex gap-2 text-sm">
                                    <span className="text-muted-foreground w-16">Subject:</span>
                                    <span className="font-medium">
                                        {priority === 'high' || priority === 'urgent' ? (
                                            <span className="text-red-500 font-bold">
                                                [{priority.toUpperCase()}]
                                            </span>
                                        ) : (
                                            <span className="text-blue-500 font-bold">
                                                [{priority.toUpperCase()}]
                                            </span>
                                        )}
                                        {' '}{subject || '(No Subject)'}
                                    </span>
                                </div>
                                <div className="flex gap-2 text-sm">
                                    <span className="text-muted-foreground w-16">From:</span>
                                    <span>Autocracy PMS &lt;notifications@autocracy.com&gt;</span>
                                </div>
                            </div>

                            {/* Fake Email Body */}
                            <div
                                className="prose dark:prose-invert max-w-none min-h-[200px] p-2"
                                dangerouslySetInnerHTML={{
                                    __html: body || '<p class="text-muted-foreground italic">Start typing to see preview...</p>'
                                }}
                            />
                        </div>

                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md flex items-start gap-2">
                            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                            <div className="text-sm text-blue-700 dark:text-blue-300">
                                <p className="font-semibold">Priority System Active</p>
                                <p>Emails with <strong>HIGH/URGENT</strong> priority will be flagged in user inboxes to ensure they are noticed.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
