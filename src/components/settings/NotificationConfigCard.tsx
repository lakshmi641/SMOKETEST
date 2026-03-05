'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Bell, Loader2, Save, Eye, EyeOff } from 'lucide-react'
import { useCompany } from '@/contexts/CompanyContext'
import { TenantService } from '@/lib/services/external-notifications/tenant-service'
import type { TenantNotificationConfig } from '@/types/tenant-schema'
import { auth } from '@/lib/firebase'
import toast from 'react-hot-toast'

export function NotificationConfigCard() {
    const { companyId, groupId } = useCompany()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showSecrets, setShowSecrets] = useState({
        sendgridApiKey: false,
        twilioAuthToken: false
    })

    const [config, setConfig] = useState<Omit<TenantNotificationConfig, 'createdAt' | 'updatedAt'>>({
        companyId: companyId || '',
        isActive: true,
        publicBaseUrl: '',
        sendgrid: {
            apiKey: '',
            fromEmail: '',
            fromName: ''
        },
        twilio: {
            accountSid: '',
            authToken: '',
            fromNumber: '',
            whatsappContentSid: '',
            whatsappMappings: {}
        }
    })

    useEffect(() => {
        loadConfig()
    }, [companyId, groupId])

    const loadConfig = async () => {
        if (!companyId) return

        try {
            setLoading(true)
            const existingConfig = await TenantService.getTenantNotificationConfig(companyId, groupId ?? undefined)

            if (existingConfig) {
                setConfig({
                    companyId: existingConfig.companyId,
                    isActive: existingConfig.isActive !== undefined ? existingConfig.isActive : true,
                    publicBaseUrl: (existingConfig as any).publicBaseUrl || '',
                    sendgrid: existingConfig.sendgrid || {},
                    twilio: existingConfig.twilio || {}
                })
            }
        } catch (error) {
            console.error('Error loading config:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!companyId) {
            toast.error('Company not found')
            return
        }

        try {
            setSaving(true)

            const currentUser = auth?.currentUser
            if (!currentUser) {
                toast.error('You must be signed in to save changes')
                return
            }

            const idToken = await currentUser.getIdToken()

            const response = await fetch('/api/tenant/notification-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    companyId,
                    groupId: groupId ?? undefined,
                    config
                })
            })

            const data = await response.json()
            if (!response.ok) {
                throw new Error(data.error || 'Failed to save configuration')
            }

            toast.success('Notification configuration saved successfully')
        } catch (error: any) {
            console.error('Error saving config:', error)
            toast.error(error.message || 'Failed to save configuration')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                    <Bell className="w-5 h-5 mr-2" />
                    Notification Configuration
                </CardTitle>
                <CardDescription>
                    Configure SendGrid and Twilio credentials for multi-channel notifications
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                {/* Active Status */}
                <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-background">
                    <div>
                        <Label className="text-foreground font-medium">Configuration Status</Label>
                        <p className="text-xs text-muted-foreground">
                            {config.isActive ? 'Notifications are enabled' : 'Notifications are disabled'}
                        </p>
                    </div>
                    <Switch
                        checked={config.isActive}
                        onCheckedChange={(checked) =>
                            setConfig(prev => ({ ...prev, isActive: checked }))
                        }
                    />
                </div>

                {/* Public Base URL Configuration */}
                <div className="space-y-4 p-4 border border-border rounded-lg bg-background">
                    <h3 className="font-semibold text-foreground">General Redirection Settings</h3>
                    <div>
                        <Label htmlFor="public-base-url">Public Base URL</Label>
                        <Input
                            id="public-base-url"
                            value={config.publicBaseUrl || ''}
                            onChange={(e) =>
                                setConfig(prev => ({ ...prev, publicBaseUrl: e.target.value }))
                            }
                            placeholder="https://autocracy.julley.app"
                            className="mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            This URL is used as the base for Email and WhatsApp notification links.
                        </p>
                    </div>
                </div>

                {/* SendGrid Configuration */}
                <div className="space-y-4 p-4 border border-border rounded-lg bg-background">
                    <h3 className="font-semibold text-foreground">SendGrid (Email)</h3>

                    <div>
                        <Label htmlFor="sendgrid-api-key">API Key</Label>
                        <div className="relative mt-2">
                            <Input
                                id="sendgrid-api-key"
                                type={showSecrets.sendgridApiKey ? 'text' : 'password'}
                                value={config.sendgrid?.apiKey || ''}
                                onChange={(e) =>
                                    setConfig(prev => ({
                                        ...prev,
                                        sendgrid: { ...prev.sendgrid, apiKey: e.target.value }
                                    }))
                                }
                                placeholder="SG.xxxxxxxxxxxxx"
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowSecrets(prev => ({ ...prev, sendgridApiKey: !prev.sendgridApiKey }))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showSecrets.sendgridApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="sendgrid-from-email">From Email</Label>
                        <Input
                            id="sendgrid-from-email"
                            type="email"
                            value={config.sendgrid?.fromEmail || ''}
                            onChange={(e) =>
                                setConfig(prev => ({
                                    ...prev,
                                    sendgrid: { ...prev.sendgrid, fromEmail: e.target.value }
                                }))
                            }
                            placeholder="noreply@yourcompany.com"
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <Label htmlFor="sendgrid-from-name">From Name</Label>
                        <Input
                            id="sendgrid-from-name"
                            value={config.sendgrid?.fromName || ''}
                            onChange={(e) =>
                                setConfig(prev => ({
                                    ...prev,
                                    sendgrid: { ...prev.sendgrid, fromName: e.target.value }
                                }))
                            }
                            placeholder="Your Company PMS"
                            className="mt-2"
                        />
                    </div>
                </div>

                {/* Twilio Configuration */}
                <div className="space-y-4 p-4 border border-border rounded-lg bg-background">
                    <h3 className="font-semibold text-foreground">Twilio (WhatsApp)</h3>

                    <div>
                        <Label htmlFor="twilio-account-sid">Account SID</Label>
                        <Input
                            id="twilio-account-sid"
                            value={config.twilio?.accountSid || ''}
                            onChange={(e) =>
                                setConfig(prev => ({
                                    ...prev,
                                    twilio: { ...prev.twilio, accountSid: e.target.value }
                                }))
                            }
                            placeholder="ACxxxxxxxxxxxxx"
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <Label htmlFor="twilio-auth-token">Auth Token</Label>
                        <div className="relative mt-2">
                            <Input
                                id="twilio-auth-token"
                                type={showSecrets.twilioAuthToken ? 'text' : 'password'}
                                value={config.twilio?.authToken || ''}
                                onChange={(e) =>
                                    setConfig(prev => ({
                                        ...prev,
                                        twilio: { ...prev.twilio, authToken: e.target.value }
                                    }))
                                }
                                placeholder="Your Twilio Auth Token"
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowSecrets(prev => ({ ...prev, twilioAuthToken: !prev.twilioAuthToken }))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showSecrets.twilioAuthToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="twilio-from-number">From Number</Label>
                        <Input
                            id="twilio-from-number"
                            value={config.twilio?.fromNumber || ''}
                            onChange={(e) =>
                                setConfig(prev => ({
                                    ...prev,
                                    twilio: { ...prev.twilio, fromNumber: e.target.value }
                                }))
                            }
                            placeholder="whatsapp:+14155238886"
                            className="mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Format: whatsapp:+1234567890
                        </p>
                    </div>

                    <div>
                        <Label htmlFor="twilio-content-sid">WhatsApp Content SID (Global Fallback)</Label>
                        <Input
                            id="twilio-content-sid"
                            value={config.twilio?.whatsappContentSid || ''}
                            onChange={(e) =>
                                setConfig(prev => ({
                                    ...prev,
                                    twilio: { ...prev.twilio, whatsappContentSid: e.target.value }
                                }))
                            }
                            placeholder="HXxxxxxxxxxxxxx"
                            className="mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Used if no specific mapping is found for an event.
                        </p>
                    </div>

                    <div className="mt-6 border-t pt-6">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                WhatsApp Event Mappings
                            </h4>
                            <p className="text-xs text-muted-foreground italic">Map specific SID for each event category</p>
                        </div>
                        <div className="space-y-4">
                            {[
                                { id: 'task_assigned', label: '1. Task Assigned' },
                                { id: 'workspace_task_request', label: '2. Task Request' },
                                { id: 'approval_required', label: '3. Approval Request' },
                                { id: 'task_escalated', label: '4. Escalation Alert' },
                                { id: 'workflow_completed', label: '5. Workflow Completion' },
                                { id: 'comment_mention', label: '6. Comment Mention' },
                                { id: 'task_reassigned', label: '7. Task Reassigned' },
                                { id: 'due_date_reminder', label: '8. Due Date Reminder' },
                            ].map((event) => (
                                <div key={event.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center p-3 border rounded-lg bg-muted/20">
                                    <div>
                                        <Label className="text-sm font-medium">{event.label}</Label>
                                        <p className="text-[10px] text-muted-foreground italic font-mono">ID: {event.id}</p>
                                    </div>
                                    <Input
                                        placeholder="Event SID (HX...)"
                                        value={(config.twilio?.whatsappMappings as any)?.[event.id] || ''}
                                        onChange={(e) =>
                                            setConfig(prev => ({
                                                ...prev,
                                                twilio: {
                                                    ...prev.twilio,
                                                    whatsappMappings: {
                                                        ...(prev.twilio?.whatsappMappings || {}),
                                                        [event.id]: e.target.value
                                                    }
                                                }
                                            }))
                                        }
                                        className="text-xs h-8"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-primary text-primary-foreground"
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Configuration
                        </>
                    )}
                </Button>
            </CardContent>
        </Card>
    )
}
