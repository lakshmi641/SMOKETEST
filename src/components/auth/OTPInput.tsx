'use client';

/**
 * OTPInput Component
 * 
 * 6-digit OTP input with:
 * - Individual boxes for each digit
 * - Auto-advance on input
 * - Backspace navigation
 * - Paste support
 * - Error state styling
 */

import { useRef, useState, useEffect, KeyboardEvent, ClipboardEvent } from 'react';

interface OTPInputProps {
    value: string;
    onChange: (value: string) => void;
    onComplete?: (value: string) => void;
    length?: number;
    disabled?: boolean;
    error?: boolean;
    autoFocus?: boolean;
}

export function OTPInput({
    value,
    onChange,
    onComplete,
    length = 6,
    disabled = false,
    error = false,
    autoFocus = true,
}: OTPInputProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

    // Initialize refs array
    useEffect(() => {
        inputRefs.current = inputRefs.current.slice(0, length);
    }, [length]);

    // Auto-focus first input
    useEffect(() => {
        if (autoFocus && inputRefs.current[0]) {
            inputRefs.current[0].focus();
        }
    }, [autoFocus]);

    // Convert value to array of digits
    const digits = value.split('').slice(0, length);
    while (digits.length < length) {
        digits.push('');
    }

    const handleChange = (index: number, inputValue: string) => {
        if (disabled) return;

        // Only allow digits
        const digit = inputValue.replace(/\D/g, '').slice(-1);

        // Update the value
        const newDigits = [...digits];
        newDigits[index] = digit;
        const newValue = newDigits.join('');
        onChange(newValue);

        // Auto-advance to next input
        if (digit && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        // Check if complete
        if (newValue.length === length && onComplete) {
            onComplete(newValue);
        }
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (disabled) return;

        // Handle backspace
        if (e.key === 'Backspace') {
            if (!digits[index] && index > 0) {
                // If current is empty, move to previous and clear it
                inputRefs.current[index - 1]?.focus();
                const newDigits = [...digits];
                newDigits[index - 1] = '';
                onChange(newDigits.join(''));
            } else {
                // Clear current
                const newDigits = [...digits];
                newDigits[index] = '';
                onChange(newDigits.join(''));
            }
        }

        // Handle arrow keys
        if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
        if (e.key === 'ArrowRight' && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        if (disabled) return;

        e.preventDefault();
        const pastedData = e.clipboardData.getData('text');
        const digits = pastedData.replace(/\D/g, '').slice(0, length);

        if (digits) {
            onChange(digits);

            // Focus the input after the last pasted digit
            const focusIndex = Math.min(digits.length, length - 1);
            inputRefs.current[focusIndex]?.focus();

            // Check if complete
            if (digits.length === length && onComplete) {
                onComplete(digits);
            }
        }
    };

    return (
        <div className="flex justify-center gap-2 sm:gap-3">
            {digits.map((digit, index) => (
                <input
                    key={index}
                    ref={(el) => {
                        inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => setFocusedIndex(null)}
                    disabled={disabled}
                    aria-label={`Digit ${index + 1}`}
                    className={`
            w-10 h-12 sm:w-12 sm:h-14 
            text-center text-xl sm:text-2xl font-bold
            border-2 rounded-lg
            bg-background text-foreground
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error
                            ? 'border-red-500 focus:ring-red-500 bg-red-50'
                            : focusedIndex === index
                                ? 'border-blue-500 focus:ring-blue-500'
                                : digit
                                    ? 'border-green-500'
                                    : 'border-gray-300'
                        }
          `}
                />
            ))}
        </div>
    );
}

export default OTPInput;
