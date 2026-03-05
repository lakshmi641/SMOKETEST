import { useState, useCallback } from 'react'
import { z } from 'zod'

interface UseFormValidationOptions<T> {
  schema: z.ZodSchema<T>
  initialValues: Partial<T>
  onSubmit?: (data: T) => void | Promise<void>
}

interface UseFormValidationReturn<T> {
  values: Partial<T>
  errors: Record<string, string>
  isValid: boolean
  isSubmitting: boolean
  setValue: (field: keyof T, value: any) => void
  setError: (field: keyof T, error: string) => void
  clearError: (field: keyof T) => void
  validateField: (field: keyof T) => boolean
  validateForm: () => boolean
  handleSubmit: (e?: React.FormEvent) => Promise<void>
  reset: () => void
}

export function useFormValidation<T extends Record<string, any>>({
  schema,
  initialValues,
  onSubmit
}: UseFormValidationOptions<T>): UseFormValidationReturn<T> {
  const [values, setValues] = useState<Partial<T>>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const setValue = useCallback((field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field as string]) {
      setErrors(prev => ({ ...prev, [field as string]: '' }))
    }
  }, [errors])

  const setError = useCallback((field: keyof T, error: string) => {
    setErrors(prev => ({ ...prev, [field as string]: error }))
  }, [])

  const clearError = useCallback((field: keyof T) => {
    setErrors(prev => ({ ...prev, [field as string]: '' }))
  }, [])

  const validateField = useCallback((field: keyof T): boolean => {
    try {
      // For object schemas, we need to check if the field exists
      if ('shape' in schema && schema.shape && typeof schema.shape === 'object' && field in schema.shape) {
        const fieldSchema = (schema.shape as any)[field]
        fieldSchema.parse(values[field])
        clearError(field)
        return true
      }
      return false
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.issues[0]?.message || 'Invalid value'
        setError(field, errorMessage)
        return false
      }
      return false
    }
  }, [schema, values, clearError, setError])

  const validateForm = useCallback((): boolean => {
    try {
      schema.parse(values)
      setErrors({})
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {}
        error.issues.forEach((err) => {
          const path = err.path.join('.')
          newErrors[path] = err.message
        })
        setErrors(newErrors)
        return false
      }
      return false
    }
  }, [schema, values])

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }

    if (!validateForm()) {
      return
    }

    if (onSubmit) {
      setIsSubmitting(true)
      try {
        await onSubmit(values as T)
      } catch (error) {
        console.error('Form submission error:', error)
        setError('general' as keyof T, 'Submission failed. Please try again.')
      } finally {
        setIsSubmitting(false)
      }
    }
  }, [validateForm, onSubmit, values, setError])

  const reset = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setIsSubmitting(false)
  }, [initialValues])

  const isValid = Object.keys(errors).length === 0 && Object.keys(values).length > 0

  return {
    values,
    errors,
    isValid,
    isSubmitting,
    setValue,
    setError,
    clearError,
    validateField,
    validateForm,
    handleSubmit,
    reset
  }
}
