'use client';

import React, { useState } from 'react';
import { EmailTemplateEditor } from './EmailTemplateEditor';
import { WhatsAppTemplateEditor } from './WhatsAppTemplateEditor';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'react-hot-toast';
import { Mail, MessageSquare } from 'lucide-react';
import type { Priority } from '@/types/external-notifications';
import { formatDate } from '@/lib/utils/date-utils';

interface TemplateBuilderProps {
    companyId: string;
}

export function TemplateBuilder({ companyId }: TemplateBuilderProps) {
    const [activeTab, setActiveTab] = useState<'email' | 'whatsapp'>('email');
    const [isSaving, setIsSaving] = useState(false);

    const handleEmailSave = async (data: { subject: string; body: string; priority: Priority }) => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/external-notifications/templates/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId,
                    name: `Email Template - ${formatDate(new Date())}`,
                    subject: data.subject,
                    htmlBody: data.body,
                    priority: data.priority
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Failed to create email template');
            }

            toast.success(result.message || `Email template saved.`);
        } catch (error: any) {
            console.error('Email save error:', error);
            toast.error(error.message || "Failed to save template.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleWhatsAppSave = async (data: { name: string; body: string }) => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/external-notifications/templates/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId,
                    name: data.name,
                    messageBody: data.body,
                    category: 'UTILITY'
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Failed to create WhatsApp template');
            }

            toast.success(result.status === 'pending_approval' ? "Submitted for Approval" : "Template Saved");
        } catch (error: any) {
            console.error('WhatsApp save error:', error);
            toast.error(error.message || "Failed to submit template.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="container mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Notification Templates</h1>
                <p className="text-muted-foreground mt-2">
                    Design and manage templates for your external notification channels.
                </p>
            </div>

            <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as 'email' | 'whatsapp')}
                className="space-y-6"
            >
                <TabsList className="grid w-full max-w-[400px] grid-cols-2">
                    <TabsTrigger value="email" className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                    </TabsTrigger>
                    <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        WhatsApp
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="email" className="space-y-4">
                    <EmailTemplateEditor
                        onSave={handleEmailSave}
                        isSaving={isSaving}
                    />
                </TabsContent>

                <TabsContent value="whatsapp" className="space-y-4">
                    <WhatsAppTemplateEditor
                        onSave={handleWhatsAppSave}
                        isSaving={isSaving}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
