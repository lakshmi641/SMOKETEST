'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Loader2, Bell } from 'lucide-react'
import { PreferenceService } from '@/lib/services/external-notifications/preference-service'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import type { UserExternalPreferences } from '@/types/external-notifications'
import { ExternalNotificationService } from '@/lib/services/external-notifications/external-notification-service'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'

const NOTIFICATION_LABELS: Record<string, string> = {
    // Task Lifecycle
    taskAssigned: 'Task Assignments',
    commentMention: 'Mentions in Comments',
    taskDueSoon: 'Task Due Soon',
    taskOverdue: 'Task Overdue',
    taskCompleted: 'Task Completed',
    taskUpdated: 'Task Updated',

    // Approval
    approvalRequired: 'Approval Requests',
    approvalApproved: 'Request Approved',
    approvalRejected: 'Request Rejected',

    // Recurring
    recurringTaskGenerated: 'Recurring Task Generated',
    recurringConfigUpdated: 'Recurring Config Updated',
    ghostTaskAlert: 'Ghost Task Alert',
    ghostTaskResolved: 'Ghost Task Resolved',
    recurringTaskPaused: 'Recurring Task Paused',
    recurringTaskReactivated: 'Recurring Task Reactivated',
    recurringScheduleEnded: 'Recurring Schedule Ended',

    // Project
    projectCreated: 'Project Created',
    projectUpdated: 'Project Updated',
    projectMilestone: 'Project Milestone',

    // System
    qualityAlert: 'Quality Alerts',
    systemAnnouncement: 'System Announcements'
}

export function UserNotificationSettings() {
    const { currentCompany, groupId } = useCompany()
    const { user } = useAuthStore()
    const [loading, setLoading] = useState(false)
    const [testing, setTesting] = useState(false)
    const [preferences, setPreferences] = useState<UserExternalPreferences | null>(null)

    useEffect(() => {
        if (currentCompany?.id && user?.id) {
            loadPreferences()
        }
    }, [currentCompany?.id, user?.id, groupId])

    const loadPreferences = async () => {
        if (!currentCompany?.id || !user?.id) return
        try {
            setLoading(true)
            const prefs = await PreferenceService.getUserPreferences(currentCompany.id, user.id, groupId ?? undefined)
            setPreferences(prefs)
        } catch (error) {
            console.error('Failed to load preferences:', error)
            toast.error('Failed to load preferences')
        } finally {
            setLoading(false)
        }
    }

    const handleToggle = async (
        category: string,
        channel: 'inApp' | 'email' | 'whatsapp',
        checked: boolean
    ) => {
        if (!preferences || !currentCompany?.id || !user?.id) return

        // 1. Optimistic Update
        const oldPreferences = { ...preferences }
        const newPreferences = {
            ...preferences,
            preferences: {
                ...preferences.preferences,
                [category]: {
                    ...preferences.preferences[category as keyof typeof preferences.preferences],
                    [channel]: checked
                }
            }
        }
        setPreferences(newPreferences)

        try {
            // 2. API Call
            await PreferenceService.updateCategoryPreference(
                currentCompany.id,
                user.id,
                category,
                channel,
                checked,
                groupId ?? undefined
            )
            toast.success('Preference saved')
        } catch (error) {
            console.error('Failed to save preference', error)
            toast.error('Failed to save')
            // Revert
            setPreferences(oldPreferences)
        }
    }

    const handleTestNotification = async () => {
        if (!currentCompany?.id || !user?.id) return
        try {
            setTesting(true)
            await ExternalNotificationService.triggerNotification(
                currentCompany.id,
                user.id,
                'task_assigned',
                {
                    subject: '🔔 Test Notification',
                    messageBody: 'This is a test notification to verify the toast system is working correctly.',
                    metadata: { test: true }
                },
                groupId ?? undefined
            )
        } catch (error) {
            console.error('Test failed:', error)
        } finally {
            setTesting(false)
        }
    }

    if (loading && !preferences) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        )
    }

    if (!preferences) return null

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" /> Notification Preferences
                </CardTitle>
                <CardDescription>
                    Customize how you receive alerts for each activity type.
                </CardDescription>
                <div className="mt-2 flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTestNotification}
                        disabled={testing}
                        className="flex items-center gap-2"
                    >
                        {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Test External Notifications
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[300px]">Activity Type</TableHead>
                            <TableHead className="text-center w-[100px]">In-App</TableHead>
                            <TableHead className="text-center w-[100px]">Email</TableHead>
                            <TableHead className="text-center w-[100px]">WhatsApp</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Object.keys(NOTIFICATION_LABELS).map((key) => {
                            const value = preferences.preferences[key as keyof typeof preferences.preferences] || { inApp: false, email: false, whatsapp: false }
                            return (
                                <TableRow key={key}>
                                    <TableCell className="font-medium">
                                        {NOTIFICATION_LABELS[key] || key}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex justify-center">
                                            <Checkbox
                                                checked={value.inApp}
                                                onCheckedChange={(c) => handleToggle(key, 'inApp', c as boolean)}
                                                aria-label={`Toggle In-App for ${key}`}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex justify-center">
                                            <Checkbox
                                                checked={value.email}
                                                onCheckedChange={(c) => handleToggle(key, 'email', c as boolean)}
                                                aria-label={`Toggle Email for ${key}`}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex justify-center">
                                            <Checkbox
                                                checked={value.whatsapp}
                                                onCheckedChange={(c) => handleToggle(key, 'whatsapp', c as boolean)}
                                                aria-label={`Toggle WhatsApp for ${key}`}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
