/**
 * Password Reset Types
 * 
 * Type definitions for the password reset feature.
 * Follows existing codebase patterns.
 */

// OTP Flow Types
export type OTPType = 'forgot' | 'change';

// Firestore Document: companies/{companyId}/password_reset_otps/{otpId}
export interface PasswordResetOTP {
    id?: string;
    email: string;
    userId: string;
    otpHash: string;              // SHA-256 hash of 6-digit OTP
    type: OTPType;
    expiresAt: string;            // ISO string (createdAt + 10 minutes)
    attempts: number;             // Failed verification attempts (max 3)
    maxAttempts: number;          // Default: 3
    used: boolean;                // Prevent reuse
    createdAt: string;            // ISO string
}

// Company Branding for Email Templates
export interface CompanyBranding {
    name: string;
    logo?: string | null;
    primaryColor: string;
}

// API Request/Response Types
export interface SendOTPRequest {
    email: string;
    companyId: string;
    type: OTPType;
}

export interface SendOTPResponse {
    success: boolean;
    message: string;
    otpId?: string;
    expiresIn?: number;           // Seconds
    error?: string;
    code?: 'USER_NOT_FOUND' | 'RATE_LIMITED' | 'EMAIL_FAILED' | 'INVALID_REQUEST';
}

export interface ResetPasswordRequest {
    otpId: string;
    otp: string;                  // 6-digit code
    newPassword: string;
    confirmPassword: string;
    companyId: string;
}

export interface ResetPasswordResponse {
    success: boolean;
    message: string;
    error?: string;
    code?: 'INVALID_OTP' | 'OTP_EXPIRED' | 'MAX_ATTEMPTS' | 'ALREADY_USED' |
    'PASSWORD_MISMATCH' | 'WEAK_PASSWORD' | 'UPDATE_FAILED';
    attemptsRemaining?: number;
}

// Password Validation
export interface PasswordValidation {
    isValid: boolean;
    hasMinLength: boolean;        // 8+ chars
    hasUpperCase: boolean;
    hasLowerCase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
    strength: 'weak' | 'medium' | 'strong';
}

// UI Modal States
export type PasswordResetStep = 'email' | 'otp' | 'password' | 'success';
export type ChangePasswordStep = 'confirm' | 'otp' | 'password' | 'success';
