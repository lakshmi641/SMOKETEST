import { VirtualProjectTemplate, ProjectType } from '@/types/project-task-template';

// RFT Templates
export const RFT_STANDARD_TEMPLATE: VirtualProjectTemplate = {
    id: 'virtual-rft-standard',
    virtualId: 'virtual-rft-standard',
    projectType: 'rft',
    name: 'Standard RFT',
    description: 'Standard Request from Teams workflow',
    category: 'operations',
    department: ['Operations', 'IT'],
    isActive: true,
    isSystemTemplate: true,
    tags: ['rft', 'request'],
    usageCount: 0,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tasks: [
        {
            id: 'task-1',
            title: 'Initial Request Review',
            description: 'Review and validate the incoming request',
            category: 'review',
            priority: 'high',
            estimatedHours: 2,
            dueDateOffsetDays: 0,
            assignedPositionId: 'default-reviewer',
            definitionOfDone: [
                { id: 'dod-1', text: 'Request validated', isRequired: true, order: 1 }
            ]
        },
        {
            id: 'task-2',
            title: 'Assign Resources',
            description: 'Allocate team members and resources',
            category: 'planning',
            priority: 'medium',
            estimatedHours: 1,
            dueDateOffsetDays: 1,
            assignedPositionId: 'default-manager',
            definitionOfDone: [
                { id: 'dod-2', text: 'Resources assigned', isRequired: true, order: 1 }
            ]
        },
        {
            id: 'task-3',
            title: 'Execute Request',
            description: 'Complete the requested work',
            category: 'execution',
            priority: 'high',
            estimatedHours: 8,
            dueDateOffsetDays: 3,
            assignedPositionId: 'default-executor',
            definitionOfDone: [
                { id: 'dod-3', text: 'Work completed', isRequired: true, order: 1 }
            ]
        }
    ]
};

export const RFT_URGENT_TEMPLATE: VirtualProjectTemplate = {
    id: 'virtual-rft-urgent',
    virtualId: 'virtual-rft-urgent',
    projectType: 'rft',
    name: 'Urgent RFT',
    description: 'Expedited Request from Teams workflow',
    category: 'operations',
    department: ['Operations'],
    isActive: true,
    isSystemTemplate: true,
    tags: ['rft', 'urgent'],
    usageCount: 0,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tasks: [
        {
            id: 'task-1',
            title: 'Immediate Assessment',
            description: 'Rapid assessment of urgent request',
            category: 'review',
            priority: 'urgent',
            estimatedHours: 1,
            dueDateOffsetDays: 0,
            assignedPositionId: 'default-reviewer',
            definitionOfDone: [
                { id: 'dod-1', text: 'Assessment complete', isRequired: true, order: 1 }
            ]
        },
        {
            id: 'task-2',
            title: 'Immediate Execution',
            description: 'Execute urgent request immediately',
            category: 'execution',
            priority: 'urgent',
            estimatedHours: 4,
            dueDateOffsetDays: 0,
            assignedPositionId: 'default-executor',
            definitionOfDone: [
                { id: 'dod-2', text: 'Work completed', isRequired: true, order: 1 }
            ]
        }
    ]
};

// Reports Templates
export const REPORTS_MONTHLY_TEMPLATE: VirtualProjectTemplate = {
    id: 'virtual-reports-monthly',
    virtualId: 'virtual-reports-monthly',
    projectType: 'reports',
    name: 'Monthly Report',
    description: 'Standard monthly reporting workflow',
    category: 'custom',
    department: ['Finance', 'Operations'],
    isActive: true,
    isSystemTemplate: true,
    tags: ['reports', 'monthly'],
    usageCount: 0,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tasks: [
        {
            id: 'task-1',
            title: 'Data Collection',
            description: 'Collect data from all departments',
            category: 'data',
            priority: 'high',
            estimatedHours: 4,
            dueDateOffsetDays: 0,
            assignedPositionId: 'default-analyst',
            definitionOfDone: [
                { id: 'dod-1', text: 'All data collected', isRequired: true, order: 1 }
            ]
        },
        {
            id: 'task-2',
            title: 'Analysis & Report Creation',
            description: 'Analyze data and create report',
            category: 'analysis',
            priority: 'high',
            estimatedHours: 6,
            dueDateOffsetDays: 2,
            assignedPositionId: 'default-analyst',
            definitionOfDone: [
                { id: 'dod-2', text: 'Report drafted', isRequired: true, order: 1 }
            ]
        },
        {
            id: 'task-3',
            title: 'Review & Approval',
            description: 'Management review and approval',
            category: 'review',
            priority: 'medium',
            estimatedHours: 2,
            dueDateOffsetDays: 5,
            assignedPositionId: 'default-manager',
            definitionOfDone: [
                { id: 'dod-3', text: 'Report approved', isRequired: true, order: 1 }
            ]
        }
    ]
};

// Compliance Templates
export const COMPLIANCE_ISO_TEMPLATE: VirtualProjectTemplate = {
    id: 'virtual-compliance-iso',
    virtualId: 'virtual-compliance-iso',
    projectType: 'compliance',
    name: 'ISO 9001 Compliance',
    description: 'ISO 9001 compliance workflow',
    category: 'operations',
    department: ['Quality', 'Operations'],
    isActive: true,
    isSystemTemplate: true,
    tags: ['compliance', 'iso'],
    usageCount: 0,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tasks: [
        {
            id: 'task-1',
            title: 'Gap Analysis',
            description: 'Identify compliance gaps',
            category: 'analysis',
            priority: 'high',
            estimatedHours: 8,
            dueDateOffsetDays: 0,
            assignedPositionId: 'default-analyst',
            definitionOfDone: [
                { id: 'dod-1', text: 'Gaps identified', isRequired: true, order: 1 }
            ]
        },
        {
            id: 'task-2',
            title: 'Remediation Plan',
            description: 'Create plan to address gaps',
            category: 'planning',
            priority: 'high',
            estimatedHours: 6,
            dueDateOffsetDays: 3,
            assignedPositionId: 'default-manager',
            definitionOfDone: [
                { id: 'dod-2', text: 'Plan approved', isRequired: true, order: 1 }
            ]
        },
        {
            id: 'task-3',
            title: 'Implementation',
            description: 'Implement remediation activities',
            category: 'execution',
            priority: 'high',
            estimatedHours: 20,
            dueDateOffsetDays: 7,
            assignedPositionId: 'default-executor',
            definitionOfDone: [
                { id: 'dod-3', text: 'Activities completed', isRequired: true, order: 1 }
            ]
        },
        {
            id: 'task-4',
            title: 'Audit & Certification',
            description: 'Final audit and certification',
            category: 'review',
            priority: 'high',
            estimatedHours: 8,
            dueDateOffsetDays: 14,
            assignedPositionId: 'default-reviewer',
            definitionOfDone: [
                { id: 'dod-4', text: 'Certification obtained', isRequired: true, order: 1 }
            ]
        }
    ]
};

export const COMPLIANCE_STATUTORY_TEMPLATE: VirtualProjectTemplate = {
    id: 'virtual-compliance-statutory',
    virtualId: 'virtual-compliance-statutory',
    projectType: 'compliance',
    name: 'Statutory Compliance',
    description: 'General statutory compliance workflow',
    category: 'operations',
    department: ['Legal', 'Compliance'],
    isActive: true,
    isSystemTemplate: true,
    tags: ['compliance', 'statutory'],
    usageCount: 0,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tasks: [
        {
            id: 'task-1',
            title: 'Regulatory Review',
            description: 'Review applicable regulations',
            category: 'review',
            priority: 'high',
            estimatedHours: 4,
            dueDateOffsetDays: 0,
            assignedPositionId: 'default-reviewer',
            definitionOfDone: [
                { id: 'dod-1', text: 'Regulations reviewed', isRequired: true, order: 1 }
            ]
        },
        {
            id: 'task-2',
            title: 'Documentation Preparation',
            description: 'Prepare compliance documentation',
            category: 'documentation',
            priority: 'high',
            estimatedHours: 8,
            dueDateOffsetDays: 2,
            assignedPositionId: 'default-executor',
            definitionOfDone: [
                { id: 'dod-2', text: 'Documentation complete', isRequired: true, order: 1 }
            ]
        },
        {
            id: 'task-3',
            title: 'Submission & Filing',
            description: 'Submit to regulatory authorities',
            category: 'execution',
            priority: 'medium',
            estimatedHours: 2,
            dueDateOffsetDays: 5,
            assignedPositionId: 'default-executor',
            definitionOfDone: [
                { id: 'dod-3', text: 'Filed successfully', isRequired: true, order: 1 }
            ]
        }
    ]
};

// Template Registry
export const VIRTUAL_TEMPLATES: Record<ProjectType, VirtualProjectTemplate[]> = {
    rft: [RFT_STANDARD_TEMPLATE, RFT_URGENT_TEMPLATE],
    reports: [REPORTS_MONTHLY_TEMPLATE],
    compliance: [COMPLIANCE_ISO_TEMPLATE, COMPLIANCE_STATUTORY_TEMPLATE],
    other: []
};

// Get templates by project type
export function getTemplatesByProjectType(projectType: ProjectType): VirtualProjectTemplate[] {
    return VIRTUAL_TEMPLATES[projectType] || [];
}

// Get single template by ID
export function getVirtualTemplateById(templateId: string): VirtualProjectTemplate | null {
    for (const templates of Object.values(VIRTUAL_TEMPLATES)) {
        const found = templates.find(t => t.id === templateId || t.virtualId === templateId);
        if (found) return found;
    }
    return null;
}
