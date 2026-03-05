'use client';

import React, { useEffect, useState } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { Bell, Mail, Smartphone, Clock } from 'lucide-react';
import type { UserExternalPreferences } from '@/types/external-notifications';
// import { PreferenceService } from '@/lib/services/external-notifications/preference-service';

// Mock service call for frontend component (replace with real API hook)
const savePreferences = async (companyId: string, userId: string, prefs: any) => {
    const response = await fetch('/api/external-notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, userId, preferences: prefs }),
    });

    if (!response.ok) {
        throw new Error('Failed to save preferences');
    }

    return response.json();
};

interface UserNotificationSettingsProps {
    userId: string;
    companyId: string;
    initialPreferences?: UserExternalPreferences;
}

export function UserNotificationSettings({
    userId,
    companyId,
    initialPreferences
}: UserNotificationSettingsProps) {
    const [loading, setLoading] = useState(false);

    // State for Task Assignment
    const [taskEmail, setTaskEmail] = useState(true);
    const [taskWhatsapp, setTaskWhatsapp] = useState(true);

    // State for Comment Mentions
    const [mentionsEmail, setMentionsEmail] = useState(true);
    const [mentionsWhatsapp, setMentionsWhatsapp] = useState(false);

    // State for Quiet Hours
    const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);

    // Load initial state if provided
    useEffect(() => {
        if (initialPreferences) {
            setTaskEmail(initialPreferences.preferences.taskAssigned.email);
            setTaskWhatsapp(initialPreferences.preferences.taskAssigned.whatsapp);
            setMentionsEmail(initialPreferences.preferences.commentMention.email);
            setMentionsWhatsapp(initialPreferences.preferences.commentMention.whatsapp);
            setQuietHoursEnabled(initialPreferences.frequencyLimits?.quietHours?.enabled ?? false);
        }
    }, [initialPreferences]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const updatedPrefs = {
                taskAssigned: { email: taskEmail, whatsapp: taskWhatsapp },
                commentMention: { email: mentionsEmail, whatsapp: mentionsWhatsapp },
                quietHours: { enabled: quietHoursEnabled, start: '22:00', end: '08:00', timezone: 'UTC' } // Simplified for MVP
            };

            await savePreferences(companyId, userId, updatedPrefs);

            toast.success("Preferences Saved: Your notification settings have been updated.");
        } catch (e) {
            toast.error("Error: Failed to save settings");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notification Channels
                </CardTitle>
                <CardDescription>
                    Choose how you want to be notified outside of the app.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">

                {/* Task Assignments */}
                <div className="space-y-4">
                    <h4 className="font-medium text-sm text-foreground">Task Assignments</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                            <div className="flex items-center space-x-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <Label htmlFor="task-email">Email</Label>
                            </div>
                            <Switch id="task-email" checked={taskEmail} onCheckedChange={setTaskEmail} />
                        </div>
                        <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                            <div className="flex items-center space-x-2">
                                <Smartphone className="h-4 w-4 text-muted-foreground" />
                                <Label htmlFor="task-wa">WhatsApp</Label>
                            </div>
                            <Switch id="task-wa" checked={taskWhatsapp} onCheckedChange={setTaskWhatsapp} />
                        </div>
                    </div>
                </div>

                {/* Comment Mentions */}
                <div className="space-y-4">
                    <h4 className="font-medium text-sm text-foreground">Comment Mentions</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                            <div className="flex items-center space-x-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <Label htmlFor="mention-email">Email</Label>
                            </div>
                            <Switch id="mention-email" checked={mentionsEmail} onCheckedChange={setMentionsEmail} />
                        </div>
                        <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                            <div className="flex items-center space-x-2">
                                <Smartphone className="h-4 w-4 text-muted-foreground" />
                                <Label htmlFor="mention-wa">WhatsApp</Label>
                            </div>
                            <Switch id="mention-wa" checked={mentionsWhatsapp} onCheckedChange={setMentionsWhatsapp} />
                        </div>
                    </div>
                </div>

                {/* Quiet Hours */}
                <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Quiet Hours
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                Pause notifications between 10 PM and 8 AM
                            </p>
                        </div>
                        <Switch checked={quietHoursEnabled} onCheckedChange={setQuietHoursEnabled} />
                    </div>
                </div>

                <Button onClick={handleSave} disabled={loading} className="w-full">
                    {loading ? 'Saving...' : 'Save Preferences'}
                </Button>
            </CardContent>
        </Card>
    );
}
