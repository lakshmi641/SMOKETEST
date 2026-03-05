"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '../../store/authStore'
import { useCompanyConfig } from '../../hooks/useCompanyConfig'
import { useCompany } from '../../contexts/CompanyContext'
import { useFormValidation } from '../../hooks/useFormValidation'
import { loginSchema } from '../../lib/validations'
import toast from 'react-hot-toast'

import { ForgotPasswordModal } from '../../components/auth/ForgotPasswordModal'

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false)
  const { user, signIn, loading: authLoading } = useAuthStore()
  const router = useRouter()
  const companyConfig = useCompanyConfig()
  const { companyId, groupId } = useCompany()

  const {
    values,
    errors,
    isValid,
    isSubmitting,
    setValue,
    handleSubmit
  } = useFormValidation({
    schema: loginSchema,
    initialValues: { email: '', password: '' },
    onSubmit: async (data) => {
      try {
        // Pass companyId to signIn to validate user belongs to this company
        if (!companyId) {
          toast.error('Unable to determine company. Please ensure you are accessing the correct subdomain.')
          return
        }

        await signIn(data.email, data.password, groupId || companyId)
        toast.success('Login successful!')
        // AuthGuard will handle the redirect to dashboard
      } catch (error: any) {
        console.error('Login error:', error)
        // Show specific error messages for access denied
        if (error.message && error.message.includes('Access denied')) {
          toast.error(error.message)
        } else {
          toast.error(error.message || 'Login failed. Please check your credentials.')
        }
      }
    }
  })

  // Show loading state while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background"></div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Promotional Panel */}
      <div className="hidden lg:flex lg:w-3/5 bg-gradient-to-br from-blue-600 via-blue-500 to-blue-400 relative overflow-hidden">
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center text-center px-16 py-20">
          {/* Building Icon */}
          {/* Company Logo or Building Icon */}
          <div className="mb-8">
            {companyConfig.logo ? (
              <div className="w-32 h-32 bg-white/10 rounded-xl flex items-center justify-center p-4 backdrop-blur-sm">
                <img
                  src={companyConfig.logo}
                  alt={`${companyConfig.name} Logo`}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7l-10-5zM6 19v-8h12v8H6z" />
                </svg>
              </div>
            )}
          </div>

          {/* Main Title */}
          <h1 className="text-4xl font-bold text-white mb-6">
            {companyConfig.name} Project Management System
          </h1>

          {/* Subtitle */}
          <p className="text-xl text-white/90 mb-8 max-w-lg">
            {companyConfig.description || `Streamline your ${companyConfig.industry.toLowerCase()} operations with intelligent project management, quality control, and compliance tracking.`}
          </p>

          {/* Features List */}
          <div className="text-left max-w-md">
            {Array.isArray(companyConfig.features) && companyConfig.features.length > 0 ? (
              companyConfig.features.map((feature, index) => (
                <div key={index} className="flex items-center mb-4">
                  <div className="w-5 h-5 bg-white/30 rounded mr-3 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-white font-medium">{feature}</span>
                </div>
              ))
            ) : (
              <div className="text-white/80 text-sm">No features configured</div>
            )}
          </div>
        </div>

        {/* Powered By Footer */}
        <div className="absolute bottom-8 left-0 right-0 z-10 flex flex-col items-center justify-center opacity-80 hover:opacity-100 transition-opacity">
          <p className="text-white/80 text-xs mb-2 uppercase tracking-wider">Powered by</p>
          <div className="flex items-center gap-2">
            <img src="/julley-logo.webp" alt="JulleyOnline" className="h-8 w-auto brightness-0 invert" />
            <span className="text-white font-bold text-lg">JulleyOnline.in</span>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center px-8 py-12 bg-background">
        <div className="w-full max-w-sm">
          {/* Mobile Header */}
          <div className="text-center mb-8 lg:hidden">
            {companyConfig.logo ? (
              <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <img
                  src={companyConfig.logo}
                  alt={`${companyConfig.name} Logo`}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7l-10-5zM6 19v-8h12v8H6z" />
                </svg>
              </div>
            )}
            <h1 className="text-2xl font-bold text-foreground mb-2">{companyConfig.name} PMS</h1>
            <p className="text-muted-foreground">Sign in to your account</p>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:block text-center mb-8">
            {companyConfig.logo ? (
              <div className="w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <img
                  src={companyConfig.logo}
                  alt={`${companyConfig.name} Logo`}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7l-10-5zM6 19v-8h12v8H6z" />
                </svg>
              </div>
            )}
            <h1 className="text-xl font-bold text-foreground mb-2">{companyConfig.name} PMS</h1>
          </div>

          {/* Login Form Container */}
          <div className="bg-card border border-border rounded-lg p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">Welcome back</h2>
              <p className="text-muted-foreground">Sign in to your account to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={values.email || ''}
                  onChange={(e) => setValue('email', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${errors.email ? 'border-destructive' : 'border-input'
                    }`}
                  placeholder="john.doe@company.com"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={values.password || ''}
                    onChange={(e) => setValue('password', e.target.value)}
                    className={`w-full px-3 py-2 pr-10 border rounded-md shadow-sm bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${errors.password ? 'border-destructive' : 'border-input'
                      }`}
                    placeholder="Enter your password"
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
                {errors.password && (
                  <p className="mt-1 text-sm text-red-500">{errors.password}</p>
                )}
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-primary focus:ring-primary border-input rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-foreground">
                    Remember me
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-500 hover:underline focus:outline-none"
                >
                  Forgot password?
                </button>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={isSubmitting || !isValid}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>


            {/* Sign Up Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{' '}
                <a href="/signup" className="font-medium text-primary hover:text-primary/80">
                  Sign up
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
      <ForgotPasswordModal
        open={isForgotPasswordOpen}
        onOpenChange={setIsForgotPasswordOpen}
        companyId={companyId || 'default'}
        groupId={groupId || undefined}
      />
    </div>
  )
}
