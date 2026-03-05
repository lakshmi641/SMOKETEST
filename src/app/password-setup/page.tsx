'use client'

/**
 * Password Setup Page
 * 
 * This page will be implemented once email integration is ready.
 * It will handle initial password setup for new users.
 * 
 * Flow:
 * 1. User verifies email
 * 2. User is redirected to this page
 * 3. User sets their password
 * 4. User is redirected to login or dashboard
 */

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PasswordSetupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null)

  useEffect(() => {
    // Check if user has valid token
    const token = searchParams.get('token')
    if (!token) {
      toast.error('Invalid or missing token')
      router.push('/login')
    }
  }, [searchParams, router])

  useEffect(() => {
    // Calculate password strength
    if (formData.password.length === 0) {
      setPasswordStrength(null)
      return
    }

    const hasMinLength = formData.password.length >= 8
    const hasUpperCase = /[A-Z]/.test(formData.password)
    const hasLowerCase = /[a-z]/.test(formData.password)
    const hasNumber = /[0-9]/.test(formData.password)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(formData.password)

    const strengthScore = [
      hasMinLength,
      hasUpperCase,
      hasLowerCase,
      hasNumber,
      hasSpecialChar,
    ].filter(Boolean).length

    if (strengthScore <= 2) {
      setPasswordStrength('weak')
    } else if (strengthScore <= 4) {
      setPasswordStrength('medium')
    } else {
      setPasswordStrength('strong')
    }
  }, [formData.password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters long')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (passwordStrength === 'weak') {
      toast.error('Please choose a stronger password')
      return
    }

    try {
      setLoading(true)
      const token = searchParams.get('token')

      // TODO: Implement password setup API call once email integration is ready
      // await setupPassword(token, formData.password)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))

      toast.success('Password set successfully!')
      
      // Redirect to login
      setTimeout(() => {
        router.push('/login?passwordSet=true')
      }, 1000)
    } catch (error: any) {
      console.error('Password setup error:', error)
      toast.error(error.message || 'Failed to set password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getPasswordStrengthColor = () => {
    if (!passwordStrength) return 'bg-gray-200'
    if (passwordStrength === 'weak') return 'bg-red-500'
    if (passwordStrength === 'medium') return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getPasswordStrengthText = () => {
    if (!passwordStrength) return ''
    if (passwordStrength === 'weak') return 'Weak'
    if (passwordStrength === 'medium') return 'Medium'
    return 'Strong'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Lock className="w-16 h-16 text-primary" />
          </div>
          <CardTitle className="text-2xl">Set Your Password</CardTitle>
          <CardDescription>
            Choose a strong password to secure your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password" className="text-foreground">Password *</Label>
              <div className="relative mt-2">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter password"
                  required
                  className="bg-background text-foreground border-border pr-10"
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordStrength && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Password strength:</span>
                    <span className={`text-xs font-medium ${
                      passwordStrength === 'weak' ? 'text-red-500' :
                      passwordStrength === 'medium' ? 'text-yellow-500' :
                      'text-green-500'
                    }`}>
                      {getPasswordStrengthText()}
                    </span>
                  </div>
                  <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${getPasswordStrengthColor()}`}
                      style={{
                        width: passwordStrength === 'weak' ? '33%' :
                               passwordStrength === 'medium' ? '66%' :
                               '100%'
                      }}
                    />
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Must be at least 8 characters with uppercase, lowercase, number, and special character
              </p>
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-foreground">Confirm Password *</Label>
              <div className="relative mt-2">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm password"
                  required
                  className="bg-background text-foreground border-border pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {formData.confirmPassword && formData.password === formData.confirmPassword && (
                <div className="flex items-center gap-2 mt-2 text-green-500 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  <span>Passwords match</span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || !formData.password || !formData.confirmPassword}
              className="w-full"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Setting Password...
                </>
              ) : (
                'Set Password'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

