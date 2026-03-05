// Manufacturing Templates Seeder - Browser Console Version
// Run this in the browser console to seed manufacturing templates

import { collection, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// Manufacturing Task Templates
const manufacturingTemplates = [
  {
    name: "Daily Production Line Setup",
    description: "Complete setup and calibration of production line equipment for daily operations",
    category: "production",
    department: ["Production", "Manufacturing"],
    positionLevel: [1, 2, 3],
    priority: "high",
    estimatedHours: 2,
    dueDateOffset: 1,
    isRecurring: true,
    assignmentType: "immediate",
    requiredSkills: ["Equipment Operation", "Safety Protocols", "Quality Control"],
    requiredCertifications: ["Forklift License", "Safety Training"],
    definitionOfDone: [
      { id: "dod-1", text: "All equipment calibrated and tested", isRequired: true, order: 1 },
      { id: "dod-2", text: "Safety checks completed and documented", isRequired: true, order: 2 },
      { id: "dod-3", text: "Production targets communicated to team", isRequired: true, order: 3 },
      { id: "dod-4", text: "Quality control samples taken", isRequired: false, order: 4 }
    ],
    approvalRequired: false,
    complianceRequirements: ["OSHA Standards", "ISO 9001"],
    qualityCheckpoints: ["Equipment calibration verification", "Safety system functionality test", "Production rate validation"],
    safetyRequirements: ["PPE inspection completed", "Emergency stop systems tested", "Lockout/tagout procedures verified"],
    tags: ["daily", "setup", "production", "equipment"],
    isActive: true,
    isSystemTemplate: true,
    createdBy: "system",
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Quality Control Inspection",
    description: "Comprehensive quality control inspection of manufactured products",
    category: "quality",
    department: ["Quality Control", "Manufacturing"],
    positionLevel: [2, 3, 4],
    priority: "high",
    estimatedHours: 3,
    dueDateOffset: 0,
    isRecurring: false,
    assignmentType: "manual",
    requiredSkills: ["Quality Inspection", "Measurement Tools", "Documentation"],
    requiredCertifications: ["Quality Inspector Certification"],
    definitionOfDone: [
      { id: "dod-1", text: "All products inspected according to specifications", isRequired: true, order: 1 },
      { id: "dod-2", text: "Defects documented and categorized", isRequired: true, order: 2 },
      { id: "dod-3", text: "Quality report generated and submitted", isRequired: true, order: 3 },
      { id: "dod-4", text: "Non-conforming products isolated", isRequired: true, order: 4 }
    ],
    approvalRequired: true,
    complianceRequirements: ["ISO 9001", "Customer Specifications"],
    qualityCheckpoints: ["Dimensional accuracy verification", "Surface finish inspection", "Functional testing completion"],
    safetyRequirements: ["Safe handling of inspection equipment", "Proper disposal of rejected materials"],
    tags: ["quality", "inspection", "compliance"],
    isActive: true,
    isSystemTemplate: true,
    createdBy: "system",
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Machine Maintenance",
    description: "Scheduled maintenance and calibration of manufacturing equipment",
    category: "maintenance",
    department: ["Maintenance", "Manufacturing"],
    positionLevel: [3, 4, 5],
    priority: "medium",
    estimatedHours: 4,
    dueDateOffset: 7,
    isRecurring: true,
    assignmentType: "scheduled",
    requiredSkills: ["Mechanical Repair", "Electrical Systems", "Preventive Maintenance"],
    requiredCertifications: ["Maintenance Technician License", "Electrical Safety"],
    definitionOfDone: [
      { id: "dod-1", text: "All scheduled maintenance tasks completed", isRequired: true, order: 1 },
      { id: "dod-2", text: "Equipment tested and operational", isRequired: true, order: 2 },
      { id: "dod-3", text: "Maintenance log updated", isRequired: true, order: 3 },
      { id: "dod-4", text: "Spare parts inventory checked", isRequired: false, order: 4 }
    ],
    approvalRequired: false,
    complianceRequirements: ["Manufacturer Guidelines", "Safety Standards"],
    qualityCheckpoints: ["Equipment performance verification", "Calibration accuracy check", "Safety system functionality"],
    safetyRequirements: ["Lockout/tagout procedures followed", "PPE worn throughout maintenance", "Work area secured and marked"],
    tags: ["maintenance", "equipment", "scheduled"],
    isActive: true,
    isSystemTemplate: true,
    createdBy: "system",
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Safety Audit",
    description: "Comprehensive safety audit of manufacturing facility and processes",
    category: "safety",
    department: ["Safety", "Manufacturing", "HR"],
    positionLevel: [4, 5],
    priority: "high",
    estimatedHours: 6,
    dueDateOffset: 14,
    isRecurring: true,
    assignmentType: "scheduled",
    requiredSkills: ["Safety Management", "Risk Assessment", "Compliance"],
    requiredCertifications: ["Safety Professional Certification", "OSHA Training"],
    definitionOfDone: [
      { id: "dod-1", text: "All safety protocols reviewed and documented", isRequired: true, order: 1 },
      { id: "dod-2", text: "Hazard identification completed", isRequired: true, order: 2 },
      { id: "dod-3", text: "Corrective actions identified and prioritized", isRequired: true, order: 3 },
      { id: "dod-4", text: "Safety report submitted to management", isRequired: true, order: 4 }
    ],
    approvalRequired: true,
    complianceRequirements: ["OSHA Standards", "Local Safety Regulations"],
    qualityCheckpoints: ["Safety equipment inspection", "Emergency response procedures review", "Training records verification"],
    safetyRequirements: ["Safe access to all areas", "Proper documentation of findings", "Immediate reporting of critical issues"],
    tags: ["safety", "audit", "compliance", "regulatory"],
    isActive: true,
    isSystemTemplate: true,
    createdBy: "system",
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Inventory Count",
    description: "Physical inventory count and reconciliation of manufacturing materials",
    category: "inventory",
    department: ["Inventory", "Manufacturing", "Warehouse"],
    positionLevel: [1, 2, 3],
    priority: "medium",
    estimatedHours: 8,
    dueDateOffset: 30,
    isRecurring: true,
    assignmentType: "scheduled",
    requiredSkills: ["Inventory Management", "Data Entry", "Attention to Detail"],
    requiredCertifications: ["Inventory Management Training"],
    definitionOfDone: [
      { id: "dod-1", text: "All inventory items counted and recorded", isRequired: true, order: 1 },
      { id: "dod-2", text: "Discrepancies identified and documented", isRequired: true, order: 2 },
      { id: "dod-3", text: "Inventory records updated in system", isRequired: true, order: 3 },
      { id: "dod-4", text: "Reconciliation report generated", isRequired: true, order: 4 }
    ],
    approvalRequired: false,
    complianceRequirements: ["Accounting Standards", "Internal Controls"],
    qualityCheckpoints: ["Count accuracy verification", "System data reconciliation", "Discrepancy analysis completion"],
    safetyRequirements: ["Safe handling of materials", "Proper use of counting equipment"],
    tags: ["inventory", "counting", "reconciliation"],
    isActive: true,
    isSystemTemplate: true,
    createdBy: "system",
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "New Employee Onboarding",
    description: "Comprehensive onboarding process for new manufacturing employees",
    category: "onboarding",
    department: ["HR", "Manufacturing", "Safety"],
    positionLevel: [1, 2],
    priority: "high",
    estimatedHours: 8,
    dueDateOffset: 1,
    isRecurring: false,
    assignmentType: "immediate",
    requiredSkills: ["Training Delivery", "Documentation", "Safety Instruction"],
    requiredCertifications: ["Trainer Certification", "Safety Training"],
    definitionOfDone: [
      { id: "dod-1", text: "All required paperwork completed", isRequired: true, order: 1 },
      { id: "dod-2", text: "Safety training completed and documented", isRequired: true, order: 2 },
      { id: "dod-3", text: "Equipment training completed", isRequired: true, order: 3 },
      { id: "dod-4", text: "Mentor assigned and introduction completed", isRequired: true, order: 4 }
    ],
    approvalRequired: true,
    complianceRequirements: ["Labor Laws", "Safety Regulations"],
    qualityCheckpoints: ["Training completion verification", "Documentation accuracy check", "Employee readiness assessment"],
    safetyRequirements: ["Safety orientation completion", "PPE fitting and training", "Emergency procedures training"],
    tags: ["onboarding", "training", "new-employee"],
    isActive: true,
    isSystemTemplate: true,
    createdBy: "system",
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Production Planning",
    description: "Weekly production planning and resource allocation",
    category: "planning",
    department: ["Production Planning", "Manufacturing"],
    positionLevel: [3, 4, 5],
    priority: "high",
    estimatedHours: 4,
    dueDateOffset: 7,
    isRecurring: true,
    assignmentType: "scheduled",
    requiredSkills: ["Production Planning", "Resource Management", "Analytics"],
    requiredCertifications: ["Production Planning Certification"],
    definitionOfDone: [
      { id: "dod-1", text: "Production schedule created for next week", isRequired: true, order: 1 },
      { id: "dod-2", text: "Resource requirements calculated", isRequired: true, order: 2 },
      { id: "dod-3", text: "Capacity constraints identified", isRequired: true, order: 3 },
      { id: "dod-4", text: "Production plan communicated to teams", isRequired: true, order: 4 }
    ],
    approvalRequired: true,
    complianceRequirements: ["Production Standards", "Resource Allocation"],
    qualityCheckpoints: ["Schedule feasibility verification", "Resource availability confirmation", "Capacity utilization analysis"],
    safetyRequirements: ["Safe working conditions consideration", "Overtime limitations compliance"],
    tags: ["planning", "production", "scheduling"],
    isActive: true,
    isSystemTemplate: true,
    createdBy: "system",
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Equipment Calibration",
    description: "Regular calibration of measurement and testing equipment",
    category: "calibration",
    department: ["Quality Control", "Maintenance"],
    positionLevel: [2, 3, 4],
    priority: "medium",
    estimatedHours: 2,
    dueDateOffset: 14,
    isRecurring: true,
    assignmentType: "scheduled",
    requiredSkills: ["Calibration Procedures", "Measurement Systems", "Documentation"],
    requiredCertifications: ["Calibration Technician Certification"],
    definitionOfDone: [
      { id: "dod-1", text: "All equipment calibrated according to standards", isRequired: true, order: 1 },
      { id: "dod-2", text: "Calibration certificates generated", isRequired: true, order: 2 },
      { id: "dod-3", text: "Equipment tagged with calibration status", isRequired: true, order: 3 },
      { id: "dod-4", text: "Calibration records updated in system", isRequired: true, order: 4 }
    ],
    approvalRequired: false,
    complianceRequirements: ["ISO 9001", "Measurement Standards"],
    qualityCheckpoints: ["Calibration accuracy verification", "Certificate validity check", "Equipment functionality test"],
    safetyRequirements: ["Safe handling of calibration equipment", "Proper disposal of calibration materials"],
    tags: ["calibration", "equipment", "quality"],
    isActive: true,
    isSystemTemplate: true,
    createdBy: "system",
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

// Function to seed templates for a specific company
export async function seedManufacturingTemplates(companyId: string) {
  try {
    console.log(`🚀 Starting to seed manufacturing templates for company: ${companyId}`)
    
    const templatesCollection = collection(db, 'companies', companyId, 'taskTemplates')
    const seededTemplates = []
    
    for (const template of manufacturingTemplates) {
      const templateData = {
        ...template,
        companyId: companyId
      }
      
      const docRef = await addDoc(templatesCollection, templateData)
      seededTemplates.push({
        id: docRef.id,
        name: template.name,
        category: template.category
      })
      
      console.log(`✅ Created template: ${template.name} (ID: ${docRef.id})`)
    }
    
    console.log(`\n🎉 Successfully seeded ${seededTemplates.length} manufacturing templates!`)
    console.log('\n📋 Seeded Templates:')
    seededTemplates.forEach(template => {
      console.log(`  - ${template.name} (${template.category})`)
    })
    
    return seededTemplates
    
  } catch (error) {
    console.error('❌ Error seeding manufacturing templates:', error)
    throw error
  }
}

// Export for use in components
export default seedManufacturingTemplates
