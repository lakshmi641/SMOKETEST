/**
 * Password Validation Utility
 * 
 * Safe for both client and server use.
 */

import type { PasswordValidation } from '@/types/password-reset';

/**
 * Validate password strength
 * Returns detailed validation for UI feedback
 */
export function validatePassword(password: string): PasswordValidation {
    const hasMinLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const score = [hasMinLength, hasUpperCase, hasLowerCase, hasNumber, hasSpecialChar]
        .filter(Boolean).length;

    let strength: 'weak' | 'medium' | 'strong';
    if (score <= 2) {
        strength = 'weak';
    } else if (score <= 4) {
        strength = 'medium';
    } else {
        strength = 'strong';
    }

    return {
        isValid: hasMinLength && hasUpperCase && hasLowerCase && hasNumber,
        hasMinLength,
        hasUpperCase,
        hasLowerCase,
        hasNumber,
        hasSpecialChar,
        strength,
    };
}
