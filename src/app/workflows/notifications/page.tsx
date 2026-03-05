'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
    Bell,
    Settings2,
    ShieldAlert,
    Clock,
    MessageSquare,
    Mail,
    Smartphone,
    ChevronRight,
    AlertCircle,
    CheckCircle2,
    Filter,
    ArrowLeft
} from 'lucide-react'
import Link from 'next/link'

export default function WorkflowNotificationsPage() {
    const [settings, setSettings] = useState({
        approvals: { email: true, push: true, inApp: true },
        escalations: { email: true, push: true, inApp: true },
        slaBreaches: { email: true, push: true, inApp: true },
        systemHealth: { email: false, push: true, inApp: true }
    })

    const toggleSetting = (category: keyof typeof settings, channel: 'email' | 'push' | 'inApp') => {
        setSettings(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [channel]: !prev[category][channel]
            }
        }))
    }

    const MOCK_LOGS = [
        {
            id: 1,
            type: 'sla_breach',
            title: 'SLA Breach: Project Alpha Approval',
            message: 'The approval for Project Alpha has exceeded the 24h SLA. Escalation path triggered.',
            time: '2 hours ago',
            severity: 'high'
        },
        {
            id: 2,
            type: 'approval_needed',
            title: 'New Approval Required',
            message: 'Workflow "Procurement V2" requires your approval for item #882.',
            time: '5 hours ago',
            severity: 'medium'
        },
        {
            id: 3,
            type: 'system',
            title: 'Workflow Engine Healthy',
            message: 'Weekly health check completed for all 42 active workflow instances.',
            time: '1 day ago',
            severity: 'low'
        }
    ]

    return (
        <DashboardLayout>
            <div className="w-full">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/workflows">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                                <Bell className="w-8 h-8 text-primary" />
                                Workflow Notifications
                            </h1>
                            <p className="text-muted-foreground mt-1">
                                Configure how and when your team is alerted about workflow events.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline">
                            <Settings2 className="w-4 h-4 mr-2" />
                            Global Settings
                        </Button>
                        <Button>
                            Save Changes
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Notification Channels / Settings */}
                    <div className="md:col-span-2 space-y-6">
                        <Card className="border-2">
                            <CardHeader>
                                <CardTitle>Notification Matrix</CardTitle>
                                <CardDescription>
                                    Define which communication channels are used for specific workflow activities.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-accent/50 border-y">
                                                <th className="text-left py-3 px-6 font-semibold">Event Type</th>
                                                <th className="py-3 px-4 text-center">In-App</th>
                                                <th className="py-3 px-4 text-center">Push</th>
                                                <th className="py-3 px-4 text-center">Email</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {[
                                                { id: 'approvals', name: 'Approvals & Requests', icon: CheckCircle2 },
                                                { id: 'escalations', name: 'Escalations & Assignments', icon: ShieldAlert },
                                                { id: 'slaBreaches', name: 'SLA Breaches & Latency', icon: Clock },
                                                { id: 'systemHealth', name: 'Engine Health & Sync', icon: Settings2 },
                                            ].map((item) => (
                                                <tr key={item.id} className="hover:bg-accent/5 transition-colors">
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center gap-3">
                                                            <item.icon className="w-5 h-5 text-muted-foreground" />
                                                            <span className="font-medium">{item.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 text-center">
                                                        <Switch
                                                            checked={settings[item.id as keyof typeof settings].inApp}
                                                            onCheckedChange={() => toggleSetting(item.id as any, 'inApp')}
                                                        />
                                                    </td>
                                                    <td className="py-4 px-4 text-center">
                                                        <Switch
                                                            checked={settings[item.id as keyof typeof settings].push}
                                                            onCheckedChange={() => toggleSetting(item.id as any, 'push')}
                                                        />
                                                    </td>
                                                    <td className="py-4 px-4 text-center">
                                                        <Switch
                                                            checked={settings[item.id as keyof typeof settings].email}
                                                            onCheckedChange={() => toggleSetting(item.id as any, 'email')}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-muted/30 py-4 flex justify-between border-t">
                                <p className="text-xs text-muted-foreground italic">
                                    * High-severity alerts always bypass email delays.
                                </p>
                                <Button variant="link" size="sm" className="h-auto p-0">
                                    Configure SMS Overrides
                                </Button>
                            </CardFooter>
                        </Card>

                        <Card className="border-2 border-dashed bg-accent/5">
                            <CardHeader className="text-center">
                                <CardTitle className="text-lg">Event Webhooks</CardTitle>
                                <CardDescription>
                                    Send workflow event payloads to external systems like Slack or Microsoft Teams.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex justify-center pb-6">
                                <Button variant="outline" className="gap-2">
                                    <MessageSquare className="w-4 h-4" />
                                    Register New Webhook
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Activity Sidebar */}
                    <div className="space-y-6">
                        <Card className="shadow-lg">
                            <CardHeader className="pb-3 border-b">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <History className="w-4 h-4" />
                                        Latest Alerts
                                    </CardTitle>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <Filter className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 px-0">
                                <div className="space-y-1">
                                    {MOCK_LOGS.map((log) => (
                                        <div key={log.id} className="px-4 py-3 hover:bg-accent/10 cursor-pointer transition-colors group border-l-4 border-transparent hover:border-primary">
                                            <div className="flex justify-between items-start mb-1">
                                                <Badge variant={log.severity === 'high' ? 'destructive' : log.severity === 'medium' ? 'default' : 'secondary'} className="text-[10px] h-4">
                                                    {log.type.replace('_', ' ')}
                                                </Badge>
                                                <span className="text-[10px] text-muted-foreground">{log.time}</span>
                                            </div>
                                            <p className="text-sm font-semibold group-hover:text-primary transition-colors leading-snug mb-1">
                                                {log.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                {log.message}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                            <CardFooter className="pt-2">
                                <Button variant="ghost" className="w-full text-sm text-muted-foreground" asChild>
                                    <Link href="/notifications">View All Notifications</Link>
                                </Button>
                            </CardFooter>
                        </Card>

                        <div className="bg-primary/5 rounded-xl p-6 border-2 border-primary/10">
                            <h4 className="font-bold flex items-center gap-2 mb-2">
                                <Smartphone className="w-5 h-5 text-primary" />
                                Mobile App
                            </h4>
                            <p className="text-xs text-muted-foreground mb-4">
                                Get instant push notifications on your phone. Download the app to stay connected.
                            </p>
                            <div className="flex gap-2">
                                <div className="bg-foreground text-background text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer">
                                    App Store
                                </div>
                                <div className="bg-foreground text-background text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer">
                                    Google Play
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}

function History({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24" height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7v5l4 2" />
        </svg>
    )
}
