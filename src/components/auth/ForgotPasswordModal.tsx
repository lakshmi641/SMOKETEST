'use client';

/**
 * ForgotPasswordModal Component
 * 
 * Multi-step modal for password reset from login page:
 * 1. Enter email
 * 2. Enter OTP
 * 3. Enter new password
 * 4. Success
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { OTPInput } from './OTPInput';
import { validatePassword } from '@/lib/utils/password-validation';
import { Mail, ArrowLeft, Eye, EyeOff, Loader2, CheckCircle2, XCircle, Lock } from 'lucide-react';
import type { PasswordResetStep, PasswordValidation } from '@/types/password-reset';

interface ForgotPasswordModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    companyId: string;
    groupId?: string;
}

export function ForgotPasswordModal({ open, onOpenChange, companyId, groupId }: ForgotPasswordModalProps) {
    // Step management
    const [step, setStep] = useState<PasswordResetStep>('email');

    // Form data
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [otpId, setOtpId] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [passwordValidation, setPasswordValidation] = useState<PasswordValidation | null>(null);

    // Reset state when modal closes
    useEffect(() => {
        if (!open) {
            setTimeout(() => {
                setStep('email');
                setEmail('');
                setOtp('');
                setOtpId('');
                setNewPassword('');
                setConfirmPassword('');
                setError('');
                setCountdown(0);
                setPasswordValidation(null);
            }, 300);
        }
    }, [open]);

    // Countdown timer
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    // Password validation
    useEffect(() => {
        if (newPassword) {
            setPasswordValidation(validatePassword(newPassword));
        } else {
            setPasswordValidation(null);
        }
    }, [newPassword]);

    // Step 1: Send OTP
    const handleSendOTP = async () => {
        if (!email.trim()) {
            setError('Please enter your email address');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    companyId,
                    groupId,
                    type: 'forgot',
                }),
            });

            const data = await response.json();

            if (data.success) {
                setOtpId(data.otpId);
                setCountdown(data.expiresIn || 600);
                setStep('otp');
            } else {
                setError(data.error || data.message || 'Failed to send code');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Move to password step (OTP verified on final submit)
    const handleOTPComplete = (value: string) => {
        setOtp(value);
        setError('');
        setStep('password');
    };

    // Step 3: Reset password
    const handleResetPassword = async () => {
        if (!passwordValidation?.isValid) {
            setError('Please enter a stronger password');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    otpId,
                    otp,
                    newPassword,
                    confirmPassword,
                    companyId,
                    groupId,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setStep('success');
            } else {
                // If OTP was wrong, go back to OTP step
                if (data.code === 'INVALID_OTP' || data.code === 'OTP_EXPIRED') {
                    setStep('otp');
                    setOtp('');
                }
                setError(data.error || data.message || 'Failed to reset password');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Resend OTP
    const handleResendOTP = async () => {
        setOtp('');
        setStep('email');
        // handleSendOTP will be called when user clicks send again
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Lock className="w-5 h-5 text-blue-600" />
                        {step === 'success' ? 'Password Reset!' : 'Reset Password'}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Enter your email to receive a password reset code.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {/* Step 1: Email Input */}
                    {step === 'email' && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Enter your email address and we'll send you a verification code.
                            </p>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                                    <XCircle className="w-4 h-4 flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            <Button
                                onClick={handleSendOTP}
                                disabled={loading || !email.trim()}
                                className="w-full"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    'Send Verification Code'
                                )}
                            </Button>
                        </div>
                    )}

                    {/* Step 2: OTP Input */}
                    {step === 'otp' && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground text-center">
                                Enter the 6-digit code sent to<br />
                                <span className="font-medium text-foreground">{email}</span>
                            </p>

                            <OTPInput
                                value={otp}
                                onChange={setOtp}
                                onComplete={handleOTPComplete}
                                error={!!error}
                                disabled={loading}
                            />

                            {countdown > 0 && (
                                <p className="text-sm text-center text-muted-foreground">
                                    Code expires in <span className="font-medium text-orange-600">{formatTime(countdown)}</span>
                                </p>
                            )}

                            {error && (
                                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                                    <XCircle className="w-4 h-4 flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div className="flex items-center justify-between">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setStep('email')}
                                >
                                    <ArrowLeft className="w-4 h-4 mr-1" />
                                    Back
                                </Button>

                                <Button
                                    variant="link"
                                    size="sm"
                                    onClick={handleResendOTP}
                                    disabled={countdown > 540} // Can resend after 1 minute
                                >
                                    Resend Code
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: New Password */}
                    {step === 'password' && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Create a new password for your account.
                            </p>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter new password"
                                        className="w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Password Strength Indicator */}
                            {passwordValidation && (
                                <div className="space-y-2">
                                    <div className="flex gap-1">
                                        {[...Array(5)].map((_, i) => (
                                            <div
                                                key={i}
                                                className={`h-1 flex-1 rounded-full transition-colors ${i < (passwordValidation.strength === 'weak' ? 1 : passwordValidation.strength === 'medium' ? 3 : 5)
                                                    ? passwordValidation.strength === 'weak'
                                                        ? 'bg-red-500'
                                                        : passwordValidation.strength === 'medium'
                                                            ? 'bg-yellow-500'
                                                            : 'bg-green-500'
                                                    : 'bg-gray-200'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-1 text-xs">
                                        <span className={passwordValidation.hasMinLength ? 'text-green-600' : 'text-muted-foreground'}>
                                            ✓ 8+ characters
                                        </span>
                                        <span className={passwordValidation.hasUpperCase ? 'text-green-600' : 'text-muted-foreground'}>
                                            ✓ Uppercase
                                        </span>
                                        <span className={passwordValidation.hasLowerCase ? 'text-green-600' : 'text-muted-foreground'}>
                                            ✓ Lowercase
                                        </span>
                                        <span className={passwordValidation.hasNumber ? 'text-green-600' : 'text-muted-foreground'}>
                                            ✓ Number
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Confirm Password</label>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                                    <XCircle className="w-4 h-4 flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setStep('otp')}
                                >
                                    <ArrowLeft className="w-4 h-4 mr-1" />
                                    Back
                                </Button>

                                <Button
                                    onClick={handleResetPassword}
                                    disabled={loading || !passwordValidation?.isValid || newPassword !== confirmPassword}
                                    className="flex-1"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Resetting...
                                        </>
                                    ) : (
                                        'Reset Password'
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Success */}
                    {step === 'success' && (
                        <div className="text-center space-y-4 py-4">
                            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-8 h-8 text-green-600" />
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold text-green-600">Password Reset Successfully!</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    You can now log in with your new password.
                                </p>
                            </div>

                            <Button onClick={() => onOpenChange(false)} className="w-full">
                                Back to Login
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default ForgotPasswordModal;
