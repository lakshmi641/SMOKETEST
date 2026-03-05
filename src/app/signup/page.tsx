"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '../../store/authStore'
import { useFormValidation } from '../../hooks/useFormValidation'
import { signupSchema } from '../../lib/validations'
import toast from 'react-hot-toast'

export default function SignupPage() {
    const [showPassword, setShowPassword] = useState(false)
    const { signUp, loading: authLoading } = useAuthStore()
    const router = useRouter()

    const {
        values,
        errors,
        isValid,
        isSubmitting,
        setValue,
        handleSubmit
    } = useFormValidation({
        schema: signupSchema,
        initialValues: { name: '', email: '', password: '', companyName: '' },
        onSubmit: async (data) => {
            try {
                const companyId = data.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000)

                await signUp(data.email, data.password, {
                    name: data.name,
                    companyId: companyId,
                    role: 'admin',
                    orgUnitName: 'Management',
                    position: 'Owner',
                    skills: [],
                    contact: { phone: '', slack: '' }
                })

                toast.success('Account created successfully!')
                router.push('/') // Redirect to dashboard
            } catch (error: any) {
                console.error('Signup error:', error)
                toast.error(error.message || 'Signup failed. Please try again.')
            }
        }
    })

    // Show loading state while checking auth state
    if (authLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex">
            {/* Left side - Promotional Panel (Reused from Login) */}
            <div className="hidden lg:flex lg:w-3/5 bg-gradient-to-br from-blue-600 via-blue-500 to-blue-400 relative overflow-hidden">
                <div className="relative z-10 flex flex-col justify-center items-center text-center px-16 py-20">
                    <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center mb-8">
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2L2 7v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7l-10-5zM6 19v-8h12v8H6z" />
                        </svg>
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-6">
                        Join the Platform
                    </h1>
                    <p className="text-xl text-white/90 mb-8 max-w-lg">
                        Create your company workspace and start managing your projects efficiently.
                    </p>
                </div>
            </div>

            {/* Right side - Signup Form */}
            <div className="w-full lg:w-2/5 flex items-center justify-center px-8 py-12 bg-background">
                <div className="w-full max-w-sm">
                    <div className="text-center mb-8 lg:hidden">
                        <h1 className="text-2xl font-bold text-foreground mb-2">Create Account</h1>
                    </div>

                    <div className="hidden lg:block text-center mb-8">
                        <h1 className="text-xl font-bold text-foreground mb-2">Create Account</h1>
                    </div>

                    <div className="bg-card border border-border rounded-lg p-8">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Name Field */}
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
                                    Full Name
                                </label>
                                <input
                                    id="name"
                                    type="text"
                                    value={values.name || ''}
                                    onChange={(e) => setValue('name', e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-md shadow-sm bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${errors.name ? 'border-destructive' : 'border-input'}`}
                                    placeholder="John Doe"
                                />
                                {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                            </div>

                            {/* Company Name Field */}
                            <div>
                                <label htmlFor="companyName" className="block text-sm font-medium text-foreground mb-1">
                                    Company Name
                                </label>
                                <input
                                    id="companyName"
                                    type="text"
                                    value={values.companyName || ''}
                                    onChange={(e) => setValue('companyName', e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-md shadow-sm bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${errors.companyName ? 'border-destructive' : 'border-input'}`}
                                    placeholder="Acme Corp"
                                />
                                {errors.companyName && <p className="mt-1 text-sm text-red-500">{errors.companyName}</p>}
                            </div>

                            {/* Email Field */}
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
                                    Email address
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={values.email || ''}
                                    onChange={(e) => setValue('email', e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-md shadow-sm bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${errors.email ? 'border-destructive' : 'border-input'}`}
                                    placeholder="john@example.com"
                                />
                                {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
                            </div>

                            {/* Password Field */}
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={values.password || ''}
                                        onChange={(e) => setValue('password', e.target.value)}
                                        className={`w-full px-3 py-2 pr-10 border rounded-md shadow-sm bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${errors.password ? 'border-destructive' : 'border-input'}`}
                                        placeholder="Create a password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                    >
                                        {showPassword ? (
                                            <EyeSlashIcon className="h-5 w-5 text-muted-foreground" />
                                        ) : (
                                            <EyeIcon className="h-5 w-5 text-muted-foreground" />
                                        )}
                                    </button>
                                </div>
                                {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isSubmitting || !isValid}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                            >
                                {isSubmitting ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                ) : (
                                    'Create Account'
                                )}
                            </button>
                        </form>

                        {/* Login Link */}
                        <div className="mt-6 text-center">
                            <p className="text-sm text-muted-foreground">
                                Already have an account?{' '}
                                <a href="/login" className="font-medium text-primary hover:text-primary/80">
                                    Sign in
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
