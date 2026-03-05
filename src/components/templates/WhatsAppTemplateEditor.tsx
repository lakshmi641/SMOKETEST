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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Smartphone } from 'lucide-react';

interface WhatsAppTemplateEditorProps {
    initialData?: {
        name: string;
        body: string;
    };
    onSave: (data: { name: string; body: string }) => void;
    isSaving: boolean;
}

export function WhatsAppTemplateEditor({ initialData, onSave, isSaving }: WhatsAppTemplateEditorProps) {
    const [name, setName] = useState(initialData?.name || '');
    const [body, setBody] = useState(initialData?.body || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ name, body });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Editor Column */}
            <div className="lg:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-green-600" />
                            WhatsApp Template
                        </CardTitle>
                        <CardDescription>
                            Create a template for WhatsApp business messages.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="name">Template Name (Internal)</Label>
                                <Input
                                    id="name"
                                    placeholder="task_assignment_v1"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                                <p className="text-xs text-muted-foreground">
                                    Use lowercase, underscores only (e.g. <code>payment_reminder</code>)
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="wa-body">Message Body</Label>
                                <Textarea
                                    id="wa-body"
                                    placeholder="Hello {{1}}, you have a new task: {{2}}"
                                    className="min-h-[150px] font-mono text-sm resize-none"
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    required
                                    maxLength={1024}
                                />
                                <div className="flex justify-between items-center">
                                    <div className="text-xs text-muted-foreground flex gap-2">
                                        <span>Variables:</span>
                                        <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
                                            {`{{1}}`}
                                        </Badge>
                                        <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
                                            {`{{2}}`}
                                        </Badge>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {body.length}/1024
                                    </span>
                                </div>
                            </div>

                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-md text-sm text-yellow-800 dark:text-yellow-200">
                                <p className="font-semibold">Approval Required</p>
                                <p>
                                    WhatsApp templates must be approved by Meta before they can be sent.
                                    This usually takes 1-24 hours. The system will automatically check status.
                                </p>
                            </div>

                            <Button
                                type="submit"
                                disabled={isSaving}
                                className="w-full bg-green-600 hover:bg-green-700 text-white"
                            >
                                {isSaving ? 'Submitting to Meta...' : 'Submit for Approval'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {/* Database/Phone Preview Column */}
            <div className="lg:col-span-1">
                <div className="sticky top-6">
                    <div className="w-[300px] mx-auto border-4 border-gray-800 rounded-[2.5rem] bg-gray-900 h-[600px] shadow-2xl overflow-hidden relative">
                        {/* Phone Notion/Island */}
                        <div className="absolute top-0 inset-x-0 h-7 bg-black z-20 flex justify-center">
                            <div className="w-24 h-5 bg-black rounded-b-xl"></div>
                        </div>

                        {/* WA Screen */}
                        <div className="h-full w-full bg-[#111b21] pt-8 flex flex-col">
                            {/* Header */}
                            <div className="bg-[#202c33] px-4 py-2 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                                    A
                                </div>
                                <div>
                                    <p className="text-gray-100 text-sm font-medium">Autocracy PMS</p>
                                    <p className="text-gray-400 text-[10px]">Business Account</p>
                                </div>
                            </div>

                            {/* Chat Area */}
                            <div className="flex-1 p-4 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat opacity-90 relative">
                                {/* Message Bubble */}
                                <div className="bg-[#202c33] p-2.5 rounded-lg rounded-tl-none max-w-[85%] shadow-sm relative mb-4">
                                    <p className="text-[#e9edef] text-sm whitespace-pre-wrap leading-relaxed">
                                        {body || 'Start typing to preview your message...'}
                                    </p>
                                    <div className="flex justify-end mt-1">
                                        <span className="text-[10px] text-gray-400">12:05 PM</span>
                                    </div>
                                </div>
                            </div>

                            {/* Input Area (Visual Only) */}
                            <div className="bg-[#202c33] h-14 w-full px-2 flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-transparent border border-gray-600"></div>
                                <div className="flex-1 h-9 rounded-full bg-[#2a3942]"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
