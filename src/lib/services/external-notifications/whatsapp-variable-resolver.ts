/**
 * WhatsApp Variable Resolver
 * Maps core system events to the numbered placeholders ({{1}}, {{2}}, etc.) 
 * required by Twilio Content API templates.
 */

/**
 * Strips the base URL from a full URL, leaving only the relative path.
 * Required by Twilio's "Static Prefix" restriction for CTA buttons.
 */
function stripBaseUrl(url: string = ''): string {
    if (!url) return '';
    const base = 'https://pms.autocracy.online/';
    const julleyBase = 'https://autocracy.julley.app/';
    const devBase = 'https://dev-autocracy.julley.app/';

    let result = url;
    if (url.startsWith(base)) result = url.replace(base, '');
    else if (url.startsWith(julleyBase)) result = url.replace(julleyBase, '');
    else if (url.startsWith(devBase)) result = url.replace(devBase, '');
    else if (url.startsWith('http')) {
        try {
            const urlObj = new URL(url);
            result = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
            if (urlObj.search) result += urlObj.search;
        } catch (e) {
            // Fallback if URL parsing fails
        }
    }

    // Ensure no leading slash
    return result.startsWith('/') ? result.substring(1) : result;
}

export function resolveWhatsAppVariables(
    eventType: string,
    context: any,
    tenantName: string
): Record<string, string> {
    switch (eventType) {
        case 'task_assigned':
        case 'rft_task_assigned':
            /**
             * MD Mapping (whatsapp_task_assigned):
             * {{2}}: actorName (assigner)
             * {{3}}: taskTitle (objectTitle)
             * {{4}}: primaryCtaUrl
             */
            return {
                '1': context.recipientName || 'Member',
                '2': context.actorName || 'Teammate',
                '3': context.objectTitle || context.taskTitle || 'a new task',
                '4': stripBaseUrl(context.primaryCtaUrl || context.actionUrl)
            };

        case 'workspace_task_request':
            /**
             * MD Mapping (whatsapp_workspace_task_request):
             * {{2}}: actorName
             * {{3}}: fromTenantName (fromCompany)
             * {{4}}: message
             * {{5}}: primaryCtaUrl
             */
            return {
                '1': context.recipientName || 'Workspace Owner',
                '2': context.actorName || 'Teammate',
                '3': context.fromTenantName || context.fromWorkspaceName || 'External Team',
                '4': context.message || context.messageBody || 'Help requested for a task.',
                '5': stripBaseUrl(context.primaryCtaUrl || context.actionUrl)
            };

        case 'approval_required':
            /**
             * MD Mapping (whatsapp_approval_request):
             * {{2}}: actorName (requester)
             * {{3}}: objectTitle
             * {{4}}: primaryCtaUrl
             */
            return {
                '1': context.recipientName || 'Approver',
                '2': context.actorName || 'Teammate',
                '3': context.objectTitle || 'Approval Stage',
                '4': stripBaseUrl(context.primaryCtaUrl || context.actionUrl)
            };

        case 'task_escalated':
            /**
             * MD Mapping (whatsapp_escalation_alert):
             * {{2}}: objectTitle
             * {{3}}: escalationLevel
             * {{4}}: primaryCtaUrl
             */
            return {
                '1': context.recipientName || 'Teammate',
                '2': context.objectTitle || 'Task',
                '3': String(context.escalationLevel || 'Alert'),
                '4': stripBaseUrl(context.primaryCtaUrl || context.actionUrl)
            };

        case 'task_overdue':
        case 'quality_alert':
            /**
             * Fallback to General Notification (whatsapp_general_notification):
             * {{2}}: subject
             * {{3}}: message
             * {{4}}: primaryCtaUrl
             */
            return {
                '1': context.recipientName || 'Member',
                '2': context.subject || 'Alert',
                '3': context.message || context.messageBody || 'Check your dashboard',
                '4': context.primaryCtaUrl || context.actionUrl || ''
            };

        case 'workflow_completed':
        case 'approval_approved':
        case 'approval_rejected':
            /**
             * MD Mapping (whatsapp_workflow_completed):
             * {{2}}: objectTitle
             * {{3}}: resourceName (result)
             * {{4}}: primaryCtaUrl
             */
            return {
                '1': context.recipientName || 'Member',
                '2': context.objectTitle || 'Workflow',
                '3': context.resourceName || context.status || 'Completed',
                '4': stripBaseUrl(context.primaryCtaUrl || context.actionUrl)
            };

        case 'task_reassigned':
            /**
             * MD Mapping (whatsapp_task_reassigned):
             * {{2}}: objectTitle
             * {{3}}: primaryCtaUrl
             */
            return {
                '1': context.recipientName || 'Member',
                '2': context.objectTitle || context.taskTitle || 'Task',
                '3': stripBaseUrl(context.primaryCtaUrl || context.actionUrl)
            };

        case 'comment_mention':
            /**
             * MD Mapping (whatsapp_mention):
             * {{2}}: actorName
             * {{3}}: objectTitle
             * {{4}}: primaryCtaUrl
             */
            return {
                '1': context.recipientName || 'Member',
                '2': context.actorName || 'Teammate',
                '3': context.objectTitle || context.taskTitle || 'Task',
                '4': stripBaseUrl(context.primaryCtaUrl || context.actionUrl)
            };

        case 'due_date_reminder':
            /**
             * MD Mapping (whatsapp_due_date_reminder):
             * {{2}}: objectTitle
             * {{4}}: timeRemaining
             * {{5}}: primaryCtaUrl
             */
            return {
                '1': context.recipientName || 'Member',
                '2': context.objectTitle || context.taskTitle || 'Task',
                '3': context.dueAt || 'Tomorrow', // MD doesn't map {{3}}, so we just populate it
                '4': context.timeRemaining || '24 hours',
                '5': stripBaseUrl(context.primaryCtaUrl || context.actionUrl)
            };

        default:
            /**
             * MD Mapping (whatsapp_general_notification):
             * {{2}}: subject
             * {{3}}: message
             * {{4}}: primaryCtaUrl
             */
            return {
                '1': context.recipientName || 'Member',
                '2': context.subject || 'Update',
                '3': context.message || context.messageBody || 'Please check your dashboard.',
                '4': stripBaseUrl(context.primaryCtaUrl || context.actionUrl)
            };
    }
}
