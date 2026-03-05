import { z } from 'zod'

// User validation schemas
export const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  ),
  role: z.enum(['admin', 'manager', 'employee'], {
    message: 'Please select a valid role'
  }),
  department: z.string().min(1, 'Department is required'),
  position: z.string().min(1, 'Position is required'),
  companyId: z.string().min(1, 'Company ID is required'),
  contact: z.object({
    phone: z.string().regex(/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number'),
    slack: z.string().min(1, 'Slack handle is required')
  }),
  skills: z.array(z.string()).min(1, 'At least one skill is required'),
  avatar: z.string().url('Please enter a valid avatar URL').optional()
})

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
})

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  companyName: z.string().min(2, 'Company name is required'),
})

// Project validation schemas
export const projectSchema = z.object({
  name: z.string().min(3, 'Project name must be at least 3 characters').max(200, 'Project name must be less than 200 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000, 'Description must be less than 1000 characters'),
  projectCode: z.string().min(2, 'Project code must be at least 2 characters').max(20, 'Project code must be less than 20 characters'),
  status: z.enum(['planning', 'active', 'on-hold', 'completed', 'cancelled']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assignedPositionId: z.string().min(1, 'Primary position assignment is required'),
  assignedUserId: z.string().optional(),
  matrixPositions: z.array(z.string()).optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  estimatedDuration: z.number().min(1, 'Estimated duration must be at least 1 day'),
  budget: z.number().min(0, 'Budget must be non-negative'),
  costCategory: z.string().min(1, 'Cost category is required'),
  department: z.string().min(1, 'Department is required'),
  businessUnit: z.string().optional(),
  costCenter: z.string().optional(),
  location: z.string().min(1, 'Location is required'),
  equipmentType: z.enum(['Industrial Robots', 'Automation Systems', 'Manufacturing Equipment', 'Quality Control Systems', 'Smart Sensors', 'other']),
  manufacturingPhase: z.enum(['Design & Engineering', 'Prototyping', 'Production Planning', 'Manufacturing', 'Quality Testing', 'Packaging & Delivery']),
  qualityStandards: z.array(z.string()).optional(),
  workflowTemplateId: z.string().optional(),
  complianceRequirements: z.array(z.string()).optional(),
  requiresApproval: z.boolean(),
  approvalMatrixId: z.string().optional(),
  definitionOfDone: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  client: z.string().optional()
}).refine((data) => {
  const startDate = new Date(data.startDate)
  const endDate = new Date(data.endDate)
  return endDate > startDate
}, {
  message: 'End date must be after start date',
  path: ['endDate']
})

// Task validation schemas
export const taskSchema = z.object({
  title: z.string().min(3, 'Task title must be at least 3 characters').max(200, 'Task title must be less than 200 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000, 'Description must be less than 1000 characters'),
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assignee: z.string().min(1, 'Assignee is required'),
  reporter: z.string().min(1, 'Reporter is required'),
  projectId: z.string().min(1, 'Project ID is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  estimatedHours: z.number().min(0, 'Estimated hours must be non-negative'),
  actualHours: z.number().min(0, 'Actual hours must be non-negative').optional(),
  tags: z.array(z.string()).optional(),
  manufacturingStep: z.string().min(1, 'Manufacturing step is required'),
  qualityCheckpoints: z.array(z.string()).optional(),
  safetyRequirements: z.array(z.string()).optional()
})

// Department validation schemas
export const departmentSchema = z.object({
  name: z.string().min(2, 'Department name must be at least 2 characters').max(100, 'Department name must be less than 100 characters'),
  code: z.string().min(2, 'Department code must be at least 2 characters').max(10, 'Department code must be less than 10 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  parentDepartmentId: z.string().optional(),
  location: z.string().min(1, 'Location is required'),
  costCenter: z.string().optional(),
  budget: z.number().min(0, 'Budget must be non-negative').optional(),
  status: z.enum(['active', 'inactive', 'archived']),
  managerId: z.string().optional()
})

// Position validation schemas
export const positionSchema = z.object({
  title: z.string().min(2, 'Position title must be at least 2 characters').max(100, 'Position title must be less than 100 characters'),
  code: z.string().min(2, 'Position code must be at least 2 characters').max(10, 'Position code must be less than 10 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  departmentId: z.string().min(1, 'Department is required'),
  level: z.number().min(1, 'Level must be at least 1').max(10, 'Level must be at most 10'),
  reportsTo: z.string().optional(),
  status: z.enum(['active', 'inactive', 'archived']),
  requirements: z.object({
    education: z.string().optional(),
    experience: z.string().optional(),
    skills: z.array(z.string()).optional(),
    certifications: z.array(z.string()).optional()
  }).optional(),
  compensation: z.object({
    minSalary: z.number().min(0, 'Minimum salary must be non-negative').optional(),
    maxSalary: z.number().min(0, 'Maximum salary must be non-negative').optional(),
    currency: z.string().length(3, 'Currency must be 3 characters').optional()
  }).optional()
})

// Generic form validation helper
export const validateForm = <T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; data?: T; errors?: Record<string, string> } => {
  try {
    const result = schema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {}
      error.issues.forEach((err) => {
        const path = err.path.join('.')
        errors[path] = err.message
      })
      return { success: false, errors }
    }
    return { success: false, errors: { general: 'Validation failed' } }
  }
}

// Field validation helper
export const validateField = <T>(schema: z.ZodSchema<T>, fieldName: string, value: unknown): string | null => {
  try {
    // For object schemas, we need to check if the field exists
    if ('shape' in schema && schema.shape && typeof schema.shape === 'object' && fieldName in schema.shape) {
      const fieldSchema = (schema.shape as any)[fieldName]
      fieldSchema.parse(value)
      return null
    }
    return 'Invalid field'
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.issues[0]?.message || 'Invalid value'
    }
    return 'Validation error'
  }
}
