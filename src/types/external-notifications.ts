/**
 * External Notification System - Type Definitions
 * 
 * This file defines all TypeScript interfaces for the Twilio/SendGrid integration.
 * Following the existing Firestore path-based multi-tenancy pattern.
 */

// ============================================================================
// Template Types
// ============================================================================

export type TemplateType = 'whatsapp' | 'email';
export type TemplateStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

// Complete EventType covering ALL notification types
export type EventType =
    // Task Lifecycle
    | 'task_assigned'
    | 'rft_task_assigned'
    | 'comment_mention'
    | 'task_due_soon'
    | 'task_overdue'
    | 'task_completed'
    | 'task_updated'
    | 'task_reassigned'
    | 'due_date_reminder'

    // Approval Workflow
    | 'approval_required'
    | 'approval_approved'
    | 'approval_rejected'

    // Recurring Tasks
    | 'recurring_task_generated'
    | 'recurring_config_updated'
    | 'ghost_task_alert'
    | 'ghost_task_resolved'
    | 'recurring_task_paused'
    | 'recurring_task_reactivated'
    | 'recurring_schedule_ended'

    // Project Management
    | 'project_created'
    | 'project_updated'
    | 'project_milestone'

    // System
    | 'quality_alert'
    | 'system_announcement'

    // Workspace Management
    | 'workspace_admin_promoted'
    | 'workspace_admin_demoted'

    // Task Requests
    | 'workspace_task_request'

    // Workflow Status
    | 'workflow_completed';

export interface TemplateAttachment {
    id: string;
    name: string;
    size: number;
    type: string;
    url?: string;
    storagePath?: string;
}

export interface ApprovalEntry {
    status: TemplateStatus;
    userId: string;
    userName: string;
    timestamp: string;
    comment?: string;
}

export interface TemplateElement {
    id: string; // Unique ID for drag & drop
    type: 'header' | 'body' | 'footer' | 'button' | 'image' | 'file';
    content: string;
    metadata?: {
        buttonType?: 'url' | 'quick_reply';
        url?: string;
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
        alignment?: 'left' | 'center' | 'right';
        fontSize?: 'sm' | 'base' | 'lg' | 'xl';
        fontWeight?: 'normal' | 'medium' | 'bold';
    };
}

export interface CompanyTemplate {
    id: string;
    companyId: string;
    name: string;
    description?: string;
    type: TemplateType;
    category?: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
    language: string; // e.g., 'en_US'

    externalId?: string; // Twilio ContentSid or SendGrid template_id
    externalVersionId?: string; // SendGrid version_id

    // Core Design (DRAG & DROP READY)
    design: {
        elements: TemplateElement[];
        attachments: TemplateAttachment[];
    };

    // Default Flag
    isDefault: boolean;
    associatedEvents: EventType[]; // Which events this template is mapped to

    // Approval & Versioning
    status: TemplateStatus;
    version: number;
    approvalTrail: ApprovalEntry[];
    rejectionReason?: string;

    // Audit
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    lastModifiedBy: string;
}

// ============================================================================
// Notification Mapping Types
// ============================================================================

export interface NotificationMapping {
    id: string;
    companyId: string; // Reference
    projectId?: string;
    workspaceId?: string;
    eventType: EventType;
    whatsappTemplateId?: string;
    emailTemplateId?: string;
    whatsappEnabled: boolean;
    emailEnabled: boolean;
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// User Preference Types
// ============================================================================

export interface ChannelPreference {
    whatsapp: boolean;
    email: boolean;
    inApp: boolean;
}

export interface UserExternalPreferences {
    id: string;
    userId: string;
    companyId: string; // Reference
    preferences: {
        // Task Lifecycle
        taskAssigned: ChannelPreference;
        commentMention: ChannelPreference;
        taskDueSoon: ChannelPreference;
        taskOverdue: ChannelPreference;
        taskCompleted: ChannelPreference;
        taskUpdated: ChannelPreference;

        // Approval Workflow
        approvalRequired: ChannelPreference;
        approvalApproved: ChannelPreference;
        approvalRejected: ChannelPreference;

        // Recurring Tasks (Admin/Workspace Admin only)
        recurringTaskGenerated: ChannelPreference;
        recurringConfigUpdated: ChannelPreference;
        ghostTaskAlert: ChannelPreference;
        ghostTaskResolved: ChannelPreference;
        recurringTaskPaused: ChannelPreference;
        recurringTaskReactivated: ChannelPreference;
        recurringScheduleEnded: ChannelPreference;

        // Project Management
        projectCreated: ChannelPreference;
        projectUpdated: ChannelPreference;
        projectMilestone: ChannelPreference;

        // System
        qualityAlert: ChannelPreference;
        systemAnnouncement: ChannelPreference;
    };
    frequencyLimits: {
        maxPerHour: number;
        maxPerDay: number;
        quietHours: {
            enabled: boolean;
            start: string; // HH:MM format
            end: string;   // HH:MM format
        };
    };
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// Tenant Configuration Types
// ============================================================================

export type TenantEnvironment = 'sandbox' | 'production';

export interface TenantConfig {
    companyId: string;
    environment?: TenantEnvironment;
    publicBaseUrl?: string;
    twilio: {
        accountSid?: string;
        authToken?: string;
        fromNumber?: string; // Format: whatsapp:+14155238886
        sandboxNumber?: string; // For testing
        whatsappContentSid?: string; // Dynamic WhatsApp Template ID (matches Firestore)
        whatsappMappings?: Partial<Record<string, string>>; // Scalable Mapping for specialized events
    };
    sendgrid: {
        apiKey?: string;
        fromEmail?: string;
        fromName?: string;
    };
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// Priority Mapping
// ============================================================================

export const EVENT_PRIORITY_MAP: Record<EventType, Priority> = {
    // Task Lifecycle
    'task_assigned': 'high',
    'rft_task_assigned': 'high',
    'comment_mention': 'medium',
    'task_due_soon': 'medium',
    'task_overdue': 'urgent',
    'task_completed': 'low',
    'task_updated': 'medium',
    'task_reassigned': 'high',
    'due_date_reminder': 'high',

    // Approval Workflow
    'approval_required': 'high',
    'approval_approved': 'medium',
    'approval_rejected': 'high',

    // Recurring Tasks
    'recurring_task_generated': 'low',
    'recurring_config_updated': 'medium',
    'ghost_task_alert': 'urgent',
    'ghost_task_resolved': 'medium',
    'recurring_task_paused': 'medium',
    'recurring_task_reactivated': 'medium',
    'recurring_schedule_ended': 'low',

    // Project Management
    'project_created': 'medium',
    'project_updated': 'low',
    'project_milestone': 'high',

    // System
    'quality_alert': 'urgent',
    'system_announcement': 'low',

    // Workspace Management
    'workspace_admin_promoted': 'high',
    'workspace_admin_demoted': 'medium',

    // Task Requests
    'workspace_task_request': 'high',

    // Workflow Status
    'workflow_completed': 'medium',
} as const;

// ============================================================================
// Message Types
// ============================================================================

export interface WhatsAppMessage {
    id: string;
    companyId: string;
    conversationId: string;
    from: string; // Phone number
    to: string;   // Phone number
    body: string;
    timestamp: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    direction: 'inbound' | 'outbound';
    metadata?: Record<string, any>;
}

export interface EmailMessage {
    id: string;
    companyId: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    priority: Priority; // ✅ Email only
    timestamp: string;
    status: 'sent' | 'delivered' | 'opened' | 'failed';
    metadata?: Record<string, any>;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface SendNotificationRequest {
    companyId: string;
    groupId?: string;
    recipientUserId: string;
    eventType: EventType;
    channel: 'whatsapp' | 'email' | 'both';
    templateData?: Record<string, any>;
    priority?: Priority; // Optional override (email only)
}

export interface SendNotificationResponse {
    success: boolean;
    channels: {
        whatsapp?: {
            sent: boolean;
            messageId?: string;
            error?: string;
            code?: number | string;
        };
        email?: {
            sent: boolean;
            messageId?: string;
            error?: string;
            code?: number | string;
        };
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

export function getPriorityForEvent(eventType: EventType): Priority {
    return EVENT_PRIORITY_MAP[eventType] || 'medium';
}

export function formatEmailSubject(baseSubject: string, priority: Priority): string {
    return `Autocracy: ${baseSubject}`;
}

export function isValidE164Phone(phone: string): boolean {
    // E.164 format: +[country code][number]
    return /^\+[1-9]\d{1,14}$/.test(phone);
}

export function formatWhatsAppNumber(phone: string): string {
    // 1. Remove all spaces and non-numeric characters EXCEPT '+' 
    const cleanPhone = phone.replace(/[^\d+]/g, '');

    // 2. Ensure WhatsApp prefix
    if (cleanPhone.startsWith('whatsapp:')) return cleanPhone;
    if (cleanPhone.startsWith('+')) return `whatsapp:${cleanPhone}`;
    return `whatsapp:+${cleanPhone}`;
}

// ============================================================================
// CHAT & CONVERSATION TYPES (Stage 7)
// ============================================================================

export interface ChatMessage {
    id: string;
    conversationId: string;
    companyId: string;
    direction: 'inbound' | 'outbound';
    type: 'text' | 'template' | 'media';
    body: string;
    status: 'sent' | 'delivered' | 'read' | 'failed' | 'received';
    sid?: string; // Twilio Message SID
    senderId?: string; // PMS User ID (if outbound)
    timestamp: string; // ISO String
}

export interface ChatConversation {
    id: string; // Usually the phone number (e.g., "whatsapp:+1234567890")
    companyId: string;
    participantName?: string; // Name of the external user
    participantPhone: string;
    lastMessage: string;
    lastMessageTimestamp: string;
    unreadCount: number;
    status: 'open' | 'closed' | 'archived';
    assignedTo?: string; // PMS User ID handling this chat
    createdAt: string;
    updatedAt: string;
}
