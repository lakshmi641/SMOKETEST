// Manufacturing-specific type definitions for Jira-like PMS

// ============================================================================
// Bill of Materials (BOM)
// ============================================================================

export interface BOMItem {
  id: string
  partNumber: string
  description: string
  quantity: number
  unit: string
  unitCost?: number
  totalCost?: number
  supplier?: string
  leadTimeDays?: number
  specifications?: Record<string, any>
  alternativeParts?: string[]
  children?: BOMItem[]
  level: number
}

export interface BillOfMaterials {
  id: string
  projectId: string
  version: string
  status: 'draft' | 'approved' | 'released' | 'obsolete'
  items: BOMItem[]
  totalCost: number
  createdBy: string
  createdAt: string
  approvedBy?: string
  approvedAt?: string
  revisionNotes?: string
  changeOrders: ChangeOrder[]
}

export interface ChangeOrder {
  id: string
  type: 'ECO' | 'ECR' | 'MCO' // Engineering Change Order, Request, Manufacturing Change Order
  description: string
  reason: string
  affectedItems: string[] // BOM item IDs
  status: 'pending' | 'approved' | 'rejected' | 'implemented'
  requestedBy: string
  requestedAt: string
  approvedBy?: string
  approvedAt?: string
}

// ============================================================================
// Production Scheduling
// ============================================================================

export interface ScheduledTask {
  taskId: string
  startDate: Date
  endDate: Date
  duration: number
  dependencies: string[]
  assignedEquipment?: string
  assignedOperator?: string
  toolingRequired?: string[]
  conflicts?: ScheduleConflict[]
  bufferTime?: number
  criticalPath: boolean
}

export interface ScheduleConflict {
  type: 'equipment' | 'operator' | 'material' | 'tooling'
  resourceId: string
  conflictingTaskId: string
  severity: 'warning' | 'error' | 'critical'
  resolution?: string
}

export interface ProductionSchedule {
  id: string
  projectId: string
  scheduledTasks: ScheduledTask[]
  milestones: Milestone[]
  constraints: ScheduleConstraint[]
  optimizationGoals: ('minimize_time' | 'minimize_cost' | 'maximize_quality')[]
  lastOptimized?: Date
  criticalPathTasks: string[]
}

export interface Milestone {
  id: string
  name: string
  targetDate: Date
  status: 'pending' | 'achieved' | 'at-risk' | 'missed'
  dependencies: string[]
}

export interface ScheduleConstraint {
  type: 'resource' | 'time' | 'precedence' | 'quality'
  description: string
  enforcementLevel: 'hard' | 'soft'
  parameters: Record<string, any>
}

// ============================================================================
// Quality Control
// ============================================================================

export interface QualityCheckpoint {
  id: string
  name: string
  description: string
  inspectionType: 'visual' | 'dimensional' | 'functional' | 'material' | 'statistical'
  acceptanceCriteria: string
  required: boolean
  order: number
  sampleSize?: number
  tolerance?: {
    nominal: number
    upper: number
    lower: number
    unit: string
  }
}

export interface InspectionResult {
  id: string
  checkpointId: string
  status: 'pass' | 'fail' | 'conditional' | 'pending'
  measuredValue?: number
  actualValue?: string
  deviation?: number
  notes?: string
  inspector: string
  inspectorSignature?: string
  timestamp: Date
  photos?: string[]
  documents?: string[]
}

export interface FirstArticleInspection {
  id: string
  taskId: string
  partNumber: string
  drawingRevision: string
  lot: string
  serialNumber?: string
  measurements: InspectionResult[]
  materialCertification?: string
  processValidation?: string
  disposition: 'approved' | 'rejected' | 'use-as-is' | 'rework'
  inspector: string
  timestamp: Date
  certificationDocs: string[]
  approvedBy?: string
  approvedAt?: Date
}

export interface NonConformanceReport {
  id: string
  ncrNumber: string
  taskId?: string
  equipmentId?: string
  partNumber?: string
  description: string
  severity: 'minor' | 'major' | 'critical'
  quantity: number
  reportedBy: string
  reportedAt: Date
  rootCause?: string
  correctiveAction?: string
  preventiveAction?: string
  disposition: 'scrap' | 'rework' | 'use-as-is' | 'return-to-supplier' | 'pending'
  status: 'open' | 'in-progress' | 'closed' | 'verified'
  assignedTo?: string
  targetCloseDate?: Date
  closedAt?: Date
  verifiedBy?: string
}

export interface QualityPlan {
  id: string
  projectId: string
  inspectionPoints: InspectionPoint[]
  samplingPlan: SamplingPlan
  acceptanceCriteria: AcceptanceCriterion[]
  nonConformanceWorkflow: string // Workflow template ID
}

export interface InspectionPoint {
  id: string
  stage: 'incoming' | 'in-process' | 'final' | 'first-article'
  checkpoints: QualityCheckpoint[]
  required: boolean
  automaticTrigger?: {
    event: 'task_start' | 'task_complete' | 'phase_change' | 'time_based'
    condition?: string
  }
}

export interface SamplingPlan {
  type: 'single' | 'double' | 'multiple' | '100%'
  lotSize?: number
  sampleSize: number
  acceptanceNumber: number
  rejectionNumber: number
  inspectionLevel: 'I' | 'II' | 'III'
}

export interface AcceptanceCriterion {
  parameter: string
  specification: string
  method: string
  frequency: string
}

// ============================================================================
// Equipment Management
// ============================================================================

export interface Equipment {
  id: string
  name: string
  type: string
  category: 'CNC' | 'Lathe' | 'Mill' | 'Assembly' | 'Testing' | 'Welding' | 'Other'
  manufacturer: string
  model: string
  serialNumber: string
  status: 'available' | 'in-use' | 'maintenance' | 'down' | 'calibration'
  location: string
  capabilities: string[]
  specifications: Record<string, any>
  purchaseDate?: Date
  warrantyExpiry?: Date
  nextMaintenanceDate?: Date
  lastCalibrationDate?: Date
  calibrationDueDate?: Date
  utilizationRate?: number
  oeeScore?: number
}

export interface MaintenanceLog {
  id: string
  equipmentId: string
  type: 'preventive' | 'corrective' | 'predictive' | 'calibration'
  description: string
  scheduledDate: Date
  completedDate?: Date
  duration: number
  technician: string
  partsUsed: { partNumber: string; quantity: number; cost: number }[]
  totalCost: number
  notes?: string
  nextScheduledDate?: Date
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
}

export interface CalibrationRecord {
  id: string
  equipmentId: string
  calibrationDate: Date
  dueDate: Date
  standard: string
  certificationNumber: string
  performedBy: string
  results: {
    parameter: string
    reading: number
    tolerance: number
    status: 'pass' | 'fail'
  }[]
  certificateUrl?: string
  notes?: string
}

export interface EquipmentBooking {
  id: string
  equipmentId: string
  taskId: string
  userId: string
  startTime: Date
  endTime: Date
  purpose: string
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
  actualStartTime?: Date
  actualEndTime?: Date
}

// ============================================================================
// Shop Floor Integration
// ============================================================================

export interface ShopFloorEvent {
  id: string
  taskId: string
  equipmentId: string
  operatorId: string
  eventType: 'start' | 'pause' | 'resume' | 'complete' | 'issue' | 'quality_check'
  timestamp: Date
  data: {
    cycleTime?: number
    partCount?: number
    scrapCount?: number
    reworkCount?: number
    qualityIssues?: string[]
    notes?: string
    photos?: string[]
  }
  location: string
}

export interface RealTimeProduction {
  taskId: string
  status: 'not-started' | 'running' | 'paused' | 'completed'
  progressPercent: number
  unitsProduced: number
  unitsTarget: number
  unitsScrap: number
  unitsRework: number
  currentCycleTime: number
  averageCycleTime: number
  targetCycleTime: number
  efficiency: number
  qualityYield: number
  oee: {
    availability: number
    performance: number
    quality: number
    overall: number
  }
  startTime?: Date
  lastUpdateTime: Date
}

export interface WorkInstruction {
  id: string
  taskId: string
  version: string
  title: string
  steps: WorkInstructionStep[]
  safetyNotes: string[]
  requiredTools: string[]
  estimatedTime: number
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  certificationRequired?: string
}

export interface WorkInstructionStep {
  number: number
  title: string
  description: string
  imageUrl?: string
  videoUrl?: string
  checklist: string[]
  safetyWarning?: string
  qualityCheck?: QualityCheckpoint
  estimatedMinutes: number
}

// ============================================================================
// Manufacturing Metrics & KPIs
// ============================================================================

export interface ManufacturingKPIs {
  period: {
    start: Date
    end: Date
  }
  oee: {
    availability: number
    performance: number
    quality: number
    overall: number
  }
  production: {
    unitsProduced: number
    unitsTarget: number
    unitsScrap: number
    firstPassYield: number
  }
  quality: {
    defectRate: number
    reworkRate: number
    scrapRate: number
    customerReturns: number
  }
  efficiency: {
    cycleTimeVariance: number
    setupTimeVariance: number
    laborEfficiency: number
    equipmentUtilization: number
  }
  delivery: {
    onTimeDelivery: number
    leadTime: number
    orderFulfillment: number
  }
  cost: {
    costPerUnit: number
    laborCostVariance: number
    materialCostVariance: number
    qualityCosts: number
  }
}

// ============================================================================
// Supplier & Vendor Management
// ============================================================================

export interface Supplier {
  id: string
  name: string
  code: string
  type: 'material' | 'component' | 'service' | 'equipment'
  contactInfo: {
    email: string
    phone: string
    address: string
    contactPerson: string
  }
  qualityRating: number
  deliveryRating: number
  costRating: number
  certifications: string[]
  approvedParts: string[]
  leadTime: {
    standard: number
    expedited?: number
  }
  terms: {
    paymentTerms: string
    minimumOrder?: number
    shippingTerms: string
  }
  status: 'active' | 'inactive' | 'on-hold' | 'disqualified'
}

export interface PurchaseOrder {
  id: string
  poNumber: string
  supplierId: string
  items: {
    partNumber: string
    description: string
    quantity: number
    unitPrice: number
    totalPrice: number
    deliveryDate: Date
  }[]
  totalAmount: number
  status: 'draft' | 'sent' | 'acknowledged' | 'in-production' | 'shipped' | 'received' | 'cancelled'
  requestedBy: string
  approvedBy?: string
  orderDate: Date
  expectedDeliveryDate: Date
  actualDeliveryDate?: Date
  notes?: string
}

// (All interfaces in this file are already exported above.)

