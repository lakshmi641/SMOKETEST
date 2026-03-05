/**
 * Password Reset Service
 * 
 * Business logic for password reset feature:
 * - OTP generation & hashing
 * - Email template generation with company branding
 * - Password validation
 * 
 * Follows existing service patterns in /lib/services/
 */

import { createHash, randomInt } from 'crypto';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { CompanyBranding } from '@/types/password-reset';
import { validatePassword } from '../../utils/password-validation';

export { validatePassword };

// ============================================================================
// OTP UTILITIES
// ============================================================================

/**
 * Generate a cryptographically secure 6-digit OTP
 */
export function generateOTP(): string {
  // crypto.randomInt is cryptographically secure
  const otp = randomInt(100000, 999999);
  return otp.toString();
}

/**
 * Hash OTP using SHA-256 (one-way, cannot be reversed)
 */
export function hashOTP(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

/**
 * Verify OTP by comparing hashes
 */
export function verifyOTPHash(inputOTP: string, storedHash: string): boolean {
  const inputHash = hashOTP(inputOTP);
  return inputHash === storedHash;
}

// ============================================================================
// COMPANY BRANDING
// ============================================================================

/**
 * Get company branding for email templates
 * Falls back to defaults if not found
 */
export async function getCompanyBranding(companyId: string, groupId?: string): Promise<CompanyBranding> {
  try {
    const docPath = groupId
      ? `enterpriseGroups/${groupId}/companies/${companyId}`
      : `companies/${companyId}`;

    const companyDoc = await getDoc(doc(db, docPath));

    if (!companyDoc.exists()) {
      return {
        name: 'Company',
        logo: null,
        primaryColor: '#4169E1',
      };
    }

    const data = companyDoc.data();
    return {
      name: data?.name || 'Company',
      logo: data?.branding?.logo || null,
      primaryColor: data?.branding?.primaryColor || '#4169E1',
    };
  } catch (error) {
    console.error('Error fetching company branding:', error);
    return {
      name: 'Company',
      logo: null,
      primaryColor: '#4169E1',
    };
  }
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

/**
 * Generate OTP email HTML with company branding
 */
export function generateOTPEmailHTML(
  branding: CompanyBranding,
  otp: string,
  type: 'forgot' | 'change'
): string {
  const title = type === 'forgot'
    ? 'Reset Your Password'
    : 'Verify Password Change';

  const description = type === 'forgot'
    ? 'We received a request to reset your password.'
    : 'You requested to change your password.';

  const year = new Date().getFullYear();
  const initial = branding.name.charAt(0).toUpperCase();

  // Inline styles for email compatibility
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${branding.name}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f7fa;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Header with Company Branding -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, ${branding.primaryColor} 0%, #4B0082 100%); border-radius: 16px 16px 0 0;">
              ${branding.logo
      ? `<img src="${branding.logo}" alt="${branding.name}" style="height: 60px; width: auto; margin-bottom: 16px;">`
      : `<div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 12px; margin: 0 auto 16px; line-height: 60px; font-size: 28px; color: white; font-weight: bold; text-align: center;">${initial}</div>`
    }
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                ${branding.name}
              </h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px 0; color: #1a1a2e; font-size: 22px; font-weight: 600; text-align: center;">
                🔐 ${title}
              </h2>
              
              <p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6; text-align: center;">
                ${description} Use the verification code below:
              </p>
              
              <!-- OTP Code Box -->
              <div style="background: linear-gradient(135deg, #f8f9ff 0%, #eef2ff 100%); border-radius: 12px; padding: 32px; text-align: center; margin: 24px 0; border: 2px dashed ${branding.primaryColor};">
                <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">
                  Verification Code
                </p>
                <div style="font-size: 42px; font-weight: 700; color: ${branding.primaryColor}; letter-spacing: 12px; font-family: 'Courier New', monospace;">
                  ${otp}
                </div>
              </div>
              
              <!-- Timer Warning -->
              <div style="background-color: #fef3cd; border-radius: 8px; padding: 16px; margin: 24px 0; border-left: 4px solid #ffc107;">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                  ⏱️ <strong>This code expires in 10 minutes.</strong> Do not share this code with anyone.
                </p>
              </div>
              
              <!-- Security Notice -->
              <p style="margin: 24px 0 0 0; color: #718096; font-size: 14px; line-height: 1.6; text-align: center;">
                If you didn't request this code, please ignore this email or contact support if you believe this is suspicious activity.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-radius: 0 0 16px 16px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center; line-height: 1.6;">
                This email was sent by ${branding.name}.<br>
                © ${year} ${branding.name}. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate password changed confirmation email
 */
export function generatePasswordChangedEmailHTML(
  branding: CompanyBranding,
  userEmail: string
): string {
  const year = new Date().getFullYear();
  const dateTime = new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
  const initial = branding.name.charAt(0).toUpperCase();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Password Changed - ${branding.name}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f7fa;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 16px 16px 0 0;">
              ${branding.logo
      ? `<img src="${branding.logo}" alt="${branding.name}" style="height: 60px; width: auto; margin-bottom: 16px;">`
      : `<div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 12px; margin: 0 auto 16px; line-height: 60px; font-size: 28px; color: white; font-weight: bold; text-align: center;">${initial}</div>`
    }
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                ${branding.name}
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
              
              <h2 style="margin: 0 0 16px 0; color: #1a1a2e; font-size: 22px; font-weight: 600;">
                Password Changed Successfully!
              </h2>
              
              <p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Your password has been updated. You can now use your new password to log in.
              </p>
              
              <!-- Security Alert -->
              <div style="background-color: #fef2f2; border-radius: 8px; padding: 16px; margin: 24px 0; border-left: 4px solid #ef4444; text-align: left;">
                <p style="margin: 0; color: #991b1b; font-size: 14px;">
                  🚨 <strong>Not you?</strong> If you didn't make this change, please contact our support team immediately.
                </p>
              </div>
              
              <p style="margin: 0; color: #718096; font-size: 14px;">
                Changed on: ${dateTime}<br>
                Account: ${userEmail}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-radius: 0 0 16px 16px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                © ${year} ${branding.name}. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// validatePassword moved to lib/utils/password-validation.ts

// ============================================================================
// CONSTANTS
// ============================================================================

export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 3;
export const RATE_LIMIT_WINDOW_MINUTES = 15;
export const RATE_LIMIT_MAX_REQUESTS = 3;
