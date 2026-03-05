/**
 * Email Template Engine
 * 
 * Provides HTML templates for the 5 core notification cases:
 * 1. Universal Notification Wrapper
 * 2. Task Lifecycle
 * 3. Workspace Collaboration
 * 4. Approval & Escalation
 * 5. Workflow Status
 */

export interface TemplateContext {
  subject?: string;
  message?: string;
  objectTitle?: string;
  actorName?: string;
  recipientName?: string;
  primaryCtaUrl?: string;
  baseUrl?: string;
  tenantDisplayName?: string;
  supportContact?: string;
  correlationId?: string;
  fromTenantName?: string;
  priority?: string;
  resourceType?: string;
  resourceName?: string;
  dueAt?: string;
  actionMessage?: string;
  escalationLevel?: string | number;
  previousAssignee?: string;
  newAssignee?: string;
  commentPreview?: string;
}

// 1. Universal Notification Wrapper
const UNIVERSAL_WRAPPER = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #3B82F6; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">{{tenantDisplayName}}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.5;">
                {{message}}
              </p>
              
              {{#if primaryCtaUrl}}
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center; padding: 16px 0;">
                    <a href="{{primaryCtaUrl}}" style="display: inline-block; background-color: #3B82F6; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500; font-size: 16px;">
                      View Details
                    </a>
                  </td>
                </tr>
              </table>
              {{/if}}
            </td>
          </tr>
            <!-- Provider Wrapper & Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <center>
                <img src="https://firebasestorage.googleapis.com/v0/b/julley-platform-dev.firebasestorage.app/o/julley-logo.webp?alt=media&token=671f43e4-9f10-4c36-bba7-c8381e387cfa" alt="Julley Online" width="100" style="display:block; margin: 0 auto 10px auto;" />
              </center>
              <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.6;">
                <strong>Sent via Julley Online on behalf of {{tenantDisplayName}}.</strong>
                <br>
                You’re receiving this because you have an account in {{tenantDisplayName}}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// 2.A Task Lifecycle - New Task Assigned
const TASK_ASSIGNED = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Task Assigned</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #10B981; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">📋 New Task Assigned</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.5;">
                Hello {{recipientName}}, <strong>{{actorName}}</strong> has assigned a new task to you.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; margin: 24px 0;">
                <tr>
                  <td style="padding: 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Task:</span>
                          <span style="color: #111827; font-size: 14px; font-weight: 500; float: right;">{{objectTitle}}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center; padding: 16px 0;">
                    <a href="{{primaryCtaUrl}}" style="display: inline-block; background-color: #10B981; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500; font-size: 16px;">
                      View Task
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <center>
                <img src="https://firebasestorage.googleapis.com/v0/b/julley-platform-dev.firebasestorage.app/o/julley-logo.webp?alt=media&token=671f43e4-9f10-4c36-bba7-c8381e387cfa" alt="Julley Online" width="100" style="display:block; margin: 0 auto 10px auto;" />
              </center>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                <strong>{{tenantDisplayName}} — powered by Julley Online</strong>
                <br>
                <span style="color: #9ca3af; font-size: 10px;">Audit ID: {{correlationId}}</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// 2.B Task Confirmation
const TASK_CONFIRMATION = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #3B82F6; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">✅ Task Successfully Delegated</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.5;">
                Your task has been successfully created in <strong>{{tenantDisplayName}}</strong> and assigned.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; margin: 24px 0;">
                <tr>
                  <td style="padding: 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding: 8px 0;"><span style="color: #6b7280; font-size: 14px;">Task:</span><span style="color: #111827; font-size: 14px; font-weight: 500; float: right;">{{objectTitle}}</span></td></tr>
                      <tr><td style="padding: 8px 0; border-top: 1px solid #e5e7eb;"><span style="color: #6b7280; font-size: 14px;">Assigned To:</span><span style="color: #111827; font-size: 14px; font-weight: 500; float: right;">{{actorName}}</span></td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center; padding: 16px 0;">
                    <a href="{{primaryCtaUrl}}" style="display: inline-block; background-color: #3B82F6; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500; font-size: 16px;">
                      View Progress
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <center>
                <img src="https://firebasestorage.googleapis.com/v0/b/julley-platform-dev.firebasestorage.app/o/julley-logo.webp?alt=media&token=671f43e4-9f10-4c36-bba7-c8381e387cfa" alt="Julley Online" width="100" style="display:block; margin: 0 auto 10px auto;" />
              </center>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">{{tenantDisplayName}} — powered by Julley Online</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// 3.A Workspace Collaboration - New Task Request
const WORKSPACE_TASK_REQUEST = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Task Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #8B5CF6; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">📥 New Task Request</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.5;">
                <strong>{{actorName}}</strong> from <strong>{{fromTenantName}}</strong> has sent a task request to {{tenantDisplayName}}.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; margin: 24px 0;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; color: #4B5563; font-style: italic;">"{{message}}"</p>
                    <p style="margin: 12px 0 0; color: #111827; font-size: 14px;"><strong>Priority:</strong> {{priority}}</p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center; padding: 16px 0;">
                    <a href="{{primaryCtaUrl}}" style="display: inline-block; background-color: #8B5CF6; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500; font-size: 16px;">
                      Respond to Request
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <center>
                <img src="https://firebasestorage.googleapis.com/v0/b/julley-platform-dev.firebasestorage.app/o/julley-logo.webp?alt=media&token=671f43e4-9f10-4c36-bba7-c8381e387cfa" alt="Julley Online" width="100" style="display:block; margin: 0 auto 10px auto;" />
              </center>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">Sent via Julley Online on behalf of {{fromTenantName}}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// 4.A Approval Request
const APPROVAL_REQUEST = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Approval Required: {{objectTitle}}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #3B82F6; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">Approval Required</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.5;">
                You have a new approval request from <strong>{{actorName}}</strong> at <strong>{{tenantDisplayName}}</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; margin: 24px 0;">
                <tr>
                  <td style="padding: 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding: 8px 0;"><span style="color: #6b7280; font-size: 14px;">Stage:</span><span style="color: #111827; font-size: 14px; font-weight: 500; float: right;">{{objectTitle}}</span></td></tr>
                      <tr><td style="padding: 8px 0; border-top: 1px solid #e5e7eb;"><span style="color: #6b7280; font-size: 14px;">{{resourceType}}:</span><span style="color: #111827; font-size: 14px; font-weight: 500; float: right;">{{resourceName}}</span></td></tr>
                      <tr><td style="padding: 8px 0; border-top: 1px solid #e5e7eb;"><span style="color: #6b7280; font-size: 14px;">Due:</span><span style="color: #111827; font-size: 14px; font-weight: 500; float: right;">{{dueAt}}</span></td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center; padding: 16px 0;">
                    <a href="{{primaryCtaUrl}}" style="display: inline-block; background-color: #3B82F6; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500; font-size: 16px;">Review & Approve</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <center>
                <img src="https://firebasestorage.googleapis.com/v0/b/julley-platform-dev.firebasestorage.app/o/julley-logo.webp?alt=media&token=671f43e4-9f10-4c36-bba7-c8381e387cfa" alt="Julley Online" width="100" style="display:block; margin: 0 auto 10px auto;" />
              </center>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">{{tenantDisplayName}} — powered by Julley Online</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// 4.B Escalation Reminder
const ESCALATION_REMINDER = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #F59E0B; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">⚠️ Escalation Alert</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.5;">
                {{actionMessage}}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; margin: 24px 0;">
                <tr>
                  <td style="padding: 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding: 8px 0;"><span style="color: #6b7280; font-size: 14px;">Stage:</span><span style="color: #111827; font-size: 14px; font-weight: 500; float: right;">{{objectTitle}}</span></td></tr>
                      <tr><td style="padding: 8px 0; border-top: 1px solid #e5e7eb;"><span style="color: #6b7280; font-size: 14px;">Escalation Level:</span><span style="color: #111827; font-size: 14px; font-weight: 500; float: right;">{{escalationLevel}}</span></td></tr>
                      <tr><td style="padding: 8px 0; border-top: 1px solid #e5e7eb;"><span style="color: #6b7280; font-size: 14px;">Originally Due:</span><span style="color: #111827; font-size: 14px; font-weight: 500; float: right;">{{dueAt}}</span></td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center; padding: 16px 0;">
                    <a href="{{primaryCtaUrl}}" style="display: inline-block; background-color: #F59E0B; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500; font-size: 16px;">Take Action Now</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <center>
                <img src="https://firebasestorage.googleapis.com/v0/b/julley-platform-dev.firebasestorage.app/o/julley-logo.webp?alt=media&token=671f43e4-9f10-4c36-bba7-c8381e387cfa" alt="Julley Online" width="100" style="display:block; margin: 0 auto 10px auto;" />
              </center>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">Sent via Julley Online on behalf of {{tenantDisplayName}}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// 5.A Workflow Status - Workflow Completed
const WORKFLOW_COMPLETED = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Workflow Completed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #10B981; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">🚀 Workflow Completed</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.5;">
                The workflow <strong>{{objectTitle}}</strong> in <strong>{{tenantDisplayName}}</strong> has been finished successfully.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; margin: 24px 0;">
                <tr>
                  <td style="padding: 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding: 8px 0;"><span style="color: #6b7280; font-size: 14px;">{{resourceType}}:</span><span style="color: #111827; font-size: 14px; font-weight: 500; float: right;">{{resourceName}}</span></td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center; padding: 16px 0;">
                    <a href="{{primaryCtaUrl}}" style="display: inline-block; background-color: #10B981; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500; font-size: 16px;">View Summary</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <center>
                <img src="https://firebasestorage.googleapis.com/v0/b/julley-platform-dev.firebasestorage.app/o/julley-logo.webp?alt=media&token=671f43e4-9f10-4c36-bba7-c8381e387cfa" alt="Julley Online" width="100" style="display:block; margin: 0 auto 10px auto;" />
              </center>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">{{tenantDisplayName}} — powered by Julley Online</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// 6.I Task Reassigned
const TASK_REASSIGNED = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Reassigned</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #3B82F6; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">🔄 Task Reassigned</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.5;">
                Hello {{recipientName}}, a task in the <strong>{{tenantDisplayName}}</strong> platform has been reassigned from <strong>{{previousAssignee}}</strong> to <strong>{{newAssignee}}</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; margin: 24px 0;">
                <tr>
                  <td style="padding: 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding: 8px 0;"><span style="color: #6b7280; font-size: 14px;">Task:</span><span style="color: #111827; font-size: 14px; font-weight: 500; float: right;">{{objectTitle}}</span></td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center; padding: 16px 0;">
                    <a href="{{primaryCtaUrl}}" style="display: inline-block; background-color: #3B82F6; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500; font-size: 16px;">
                      View Details
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <center>
                <img src="https://firebasestorage.googleapis.com/v0/b/julley-platform-dev.firebasestorage.app/o/julley-logo.webp?alt=media&token=671f43e4-9f10-4c36-bba7-c8381e387cfa" alt="Julley Online" width="100" style="display:block; margin: 0 auto 10px auto;" />
              </center>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">{{tenantDisplayName}} — powered by Julley Online</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// 6.K Comment/Mention Notification
const COMMENT_MENTION = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You were mentioned</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #3B82F6; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">💬 You were mentioned</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.5;">
                Hello {{recipientName}}, <strong>{{actorName}}</strong> mentioned you in the <strong>{{tenantDisplayName}}</strong> platform on "{{objectTitle}}":
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; margin: 24px 0;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; color: #4B5563; font-style: italic;">"{{commentPreview}}"</p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center; padding: 16px 0;">
                    <a href="{{primaryCtaUrl}}" style="display: inline-block; background-color: #3B82F6; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500; font-size: 16px;">
                      View Conversation
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <center>
                <img src="https://firebasestorage.googleapis.com/v0/b/julley-platform-dev.firebasestorage.app/o/julley-logo.webp?alt=media&token=671f43e4-9f10-4c36-bba7-c8381e387cfa" alt="Julley Online" width="100" style="display:block; margin: 0 auto 10px auto;" />
              </center>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">{{tenantDisplayName}} — powered by Julley Online</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// 6.L Due Date Reminder
const DUE_DATE_REMINDER = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Due Soon</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #F59E0B; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">⏰ Task Due Soon</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.5;">
                Hello {{recipientName}}, reminder from the <strong>{{tenantDisplayName}}</strong> platform - your task is due soon!
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; margin: 24px 0;">
                <tr>
                  <td style="padding: 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding: 8px 0;"><span style="color: #6b7280; font-size: 14px;">Task:</span><span style="color: #111827; font-size: 14px; font-weight: 500; float: right;">{{objectTitle}}</span></td></tr>
                      <tr><td style="padding: 8px 0; border-top: 1px solid #e5e7eb;"><span style="color: #6b7280; font-size: 14px;">Due Date:</span><span style="color: #111827; font-size: 14px; font-weight: 500; float: right;">{{dueAt}}</span></td></tr>
                      <tr><td style="padding: 8px 0; border-top: 1px solid #e5e7eb;"><span style="color: #6b7280; font-size: 14px;">Time Remaining:</span><span style="color: #111827; font-size: 14px; font-weight: 500; float: right;">{{timeRemaining}}</span></td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center; padding: 16px 0;">
                    <a href="{{primaryCtaUrl}}" style="display: inline-block; background-color: #F59E0B; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500; font-size: 16px;">
                      Complete Task
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <center>
                <img src="https://firebasestorage.googleapis.com/v0/b/julley-platform-dev.firebasestorage.app/o/julley-logo.webp?alt=media&token=671f43e4-9f10-4c36-bba7-c8381e387cfa" alt="Julley Online" width="100" style="display:block; margin: 0 auto 10px auto;" />
              </center>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">{{tenantDisplayName}} — powered by Julley Online</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

type TemplateName = 'universal' | 'task_assigned' | 'task_confirmation' | 'workspace_task_request' | 'approval_request' | 'escalation_reminder' | 'workflow_completed' | 'task_reassigned' | 'comment_mention' | 'due_date_reminder';

const TEMPLATES: Record<TemplateName, string> = {
  universal: UNIVERSAL_WRAPPER,
  task_assigned: TASK_ASSIGNED,
  task_confirmation: TASK_CONFIRMATION,
  workspace_task_request: WORKSPACE_TASK_REQUEST,
  approval_request: APPROVAL_REQUEST,
  escalation_reminder: ESCALATION_REMINDER,
  workflow_completed: WORKFLOW_COMPLETED,
  task_reassigned: TASK_REASSIGNED,
  comment_mention: COMMENT_MENTION,
  due_date_reminder: DUE_DATE_REMINDER
};

/**
 * Renders a template with the provided context
 */
export function renderEmailTemplate(templateName: TemplateName, context: TemplateContext): string {
  let html = TEMPLATES[templateName] || TEMPLATES.universal;

  // Default values for common fields
  const enrichedContext = {
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    tenantDisplayName: 'Platform',
    supportContact: 'https://support.julley.online',
    correlationId: 'N/A',
    ...context
  };

  // Simple Handlebars-like replacement
  Object.entries(enrichedContext).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, String(value || ''));
  });

  // Handle {{#if primaryCtaUrl}} ... {{/if}}
  if (enrichedContext.primaryCtaUrl) {
    html = html.replace(/{{#if primaryCtaUrl}}([\s\S]*?){{\/if}}/g, '$1');
  } else {
    html = html.replace(/{{#if primaryCtaUrl}}([\s\S]*?){{\/if}}/g, '');
  }

  return html.trim();
}
