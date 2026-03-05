/**
 * Generate Sample WBS Excel File
 * 
 * Creates a realistic construction project with 40 tasks,
 * 4 milestones, and a clear critical path.
 */

import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

// Helper to add days to a date
function addDays(date: Date, days: number): Date {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
}

// Format date as YYYY-MM-DD
function formatDate(date: Date): string {
    return date.toISOString().split('T')[0] || ''
}

// Project starts December 16, 2024 (Monday)
const PROJECT_START = new Date('2024-12-16')

interface TaskData {
    name: string
    description: string
    startOffset: number // Days from project start
    duration: number // Days
    milestone: boolean
    predecessor: string
    depType: string
    lag: number
    isCritical: boolean // For documentation
}

// Create realistic construction project tasks
const tasks: TaskData[] = [
    // ===== PHASE 1: PROJECT INITIATION =====
    {
        name: 'Project Kickoff',
        description: 'Initial project meeting with all stakeholders',
        startOffset: 0, duration: 0, milestone: true,
        predecessor: '', depType: '', lag: 0, isCritical: true
    },
    {
        name: 'Site Survey',
        description: 'Complete land survey and soil testing',
        startOffset: 1, duration: 5,
        predecessor: 'Project Kickoff', depType: 'FS', lag: 1, isCritical: true, milestone: false
    },
    {
        name: 'Permit Application',
        description: 'Submit building permits to city',
        startOffset: 1, duration: 10,
        predecessor: 'Project Kickoff', depType: 'FS', lag: 1, isCritical: false, milestone: false
    },
    {
        name: 'Architectural Design',
        description: 'Complete architectural drawings',
        startOffset: 7, duration: 14,
        predecessor: 'Site Survey', depType: 'FS', lag: 1, isCritical: true, milestone: false
    },
    {
        name: 'Structural Engineering',
        description: 'Structural calculations and drawings',
        startOffset: 14, duration: 10,
        predecessor: 'Architectural Design', depType: 'SS', lag: 7, isCritical: true, milestone: false
    },
    {
        name: 'MEP Design',
        description: 'Mechanical, Electrical, Plumbing design',
        startOffset: 21, duration: 10,
        predecessor: 'Architectural Design', depType: 'FS', lag: 0, isCritical: false, milestone: false
    },
    {
        name: 'Permit Approval',
        description: 'Receive building permits',
        startOffset: 25, duration: 5,
        predecessor: 'Permit Application', depType: 'FS', lag: 14, isCritical: false, milestone: false
    },
    {
        name: 'Design Complete',
        description: 'All design documents approved',
        startOffset: 31, duration: 0, milestone: true,
        predecessor: 'Structural Engineering, MEP Design', depType: 'FS', lag: 0, isCritical: true
    },

    // ===== PHASE 2: SITE PREPARATION =====
    {
        name: 'Site Clearing',
        description: 'Clear vegetation and debris',
        startOffset: 32, duration: 5,
        predecessor: 'Design Complete', depType: 'FS', lag: 1, isCritical: true, milestone: false
    },
    {
        name: 'Temporary Utilities',
        description: 'Install temporary power and water',
        startOffset: 32, duration: 3,
        predecessor: 'Design Complete', depType: 'FS', lag: 1, isCritical: false, milestone: false
    },
    {
        name: 'Site Grading',
        description: 'Level and grade the site',
        startOffset: 37, duration: 4,
        predecessor: 'Site Clearing', depType: 'FS', lag: 0, isCritical: true, milestone: false
    },
    {
        name: 'Excavation',
        description: 'Excavate for foundation',
        startOffset: 41, duration: 6,
        predecessor: 'Site Grading', depType: 'FS', lag: 0, isCritical: true, milestone: false
    },

    // ===== PHASE 3: FOUNDATION =====
    {
        name: 'Foundation Rebar',
        description: 'Install foundation reinforcement',
        startOffset: 47, duration: 5,
        predecessor: 'Excavation', depType: 'FS', lag: 0, isCritical: true, milestone: false
    },
    {
        name: 'Foundation Formwork',
        description: 'Build foundation forms',
        startOffset: 47, duration: 4,
        predecessor: 'Excavation', depType: 'FS', lag: 0, isCritical: false, milestone: false
    },
    {
        name: 'Foundation Pour',
        description: 'Pour concrete foundation',
        startOffset: 52, duration: 2,
        predecessor: 'Foundation Rebar, Foundation Formwork', depType: 'FS', lag: 0, isCritical: true, milestone: false
    },
    {
        name: 'Foundation Curing',
        description: 'Allow concrete to cure',
        startOffset: 54, duration: 7,
        predecessor: 'Foundation Pour', depType: 'FS', lag: 0, isCritical: true, milestone: false
    },
    {
        name: 'Foundation Complete',
        description: 'Foundation inspection passed',
        startOffset: 61, duration: 0, milestone: true,
        predecessor: 'Foundation Curing', depType: 'FS', lag: 0, isCritical: true
    },

    // ===== PHASE 4: STRUCTURAL =====
    {
        name: 'Column Installation',
        description: 'Erect structural columns',
        startOffset: 62, duration: 8,
        predecessor: 'Foundation Complete', depType: 'FS', lag: 1, isCritical: true, milestone: false
    },
    {
        name: 'Beam Installation',
        description: 'Install structural beams',
        startOffset: 70, duration: 6,
        predecessor: 'Column Installation', depType: 'FS', lag: 0, isCritical: true, milestone: false
    },
    {
        name: 'Floor Slab - Level 1',
        description: 'Pour first floor concrete slab',
        startOffset: 76, duration: 3,
        predecessor: 'Beam Installation', depType: 'FS', lag: 0, isCritical: true, milestone: false
    },
    {
        name: 'Floor Slab - Level 2',
        description: 'Pour second floor concrete slab',
        startOffset: 79, duration: 3,
        predecessor: 'Floor Slab - Level 1', depType: 'FS', lag: 0, isCritical: true, milestone: false
    },
    {
        name: 'Roof Structure',
        description: 'Install roof trusses and decking',
        startOffset: 82, duration: 5,
        predecessor: 'Floor Slab - Level 2', depType: 'FS', lag: 0, isCritical: true, milestone: false
    },
    {
        name: 'Roofing',
        description: 'Install waterproofing and roofing',
        startOffset: 87, duration: 4,
        predecessor: 'Roof Structure', depType: 'FS', lag: 0, isCritical: true, milestone: false
    },

    // ===== PHASE 5: ENCLOSURE =====
    {
        name: 'Exterior Walls',
        description: 'Build exterior wall framing',
        startOffset: 85, duration: 10,
        predecessor: 'Floor Slab - Level 2', depType: 'FS', lag: 3, isCritical: false, milestone: false
    },
    {
        name: 'Windows Installation',
        description: 'Install all windows',
        startOffset: 95, duration: 5,
        predecessor: 'Exterior Walls', depType: 'FS', lag: 0, isCritical: false, milestone: false
    },
    {
        name: 'Exterior Doors',
        description: 'Install main entry doors',
        startOffset: 95, duration: 3,
        predecessor: 'Exterior Walls', depType: 'FS', lag: 0, isCritical: false, milestone: false
    },
    {
        name: 'Building Enclosed',
        description: 'Building is weather-tight',
        startOffset: 100, duration: 0, milestone: true,
        predecessor: 'Roofing, Windows Installation, Exterior Doors', depType: 'FS', lag: 0, isCritical: true
    },

    // ===== PHASE 6: MEP ROUGH-IN =====
    {
        name: 'Electrical Rough-In',
        description: 'Run electrical wiring',
        startOffset: 91, duration: 12,
        predecessor: 'Roofing', depType: 'FS', lag: 0, isCritical: true, milestone: false
    },
    {
        name: 'Plumbing Rough-In',
        description: 'Install plumbing pipes',
        startOffset: 91, duration: 10,
        predecessor: 'Roofing', depType: 'FS', lag: 0, isCritical: false, milestone: false
    },
    {
        name: 'HVAC Rough-In',
        description: 'Install ductwork and units',
        startOffset: 91, duration: 14,
        predecessor: 'Roofing', depType: 'FS', lag: 0, isCritical: false, milestone: false
    },
    {
        name: 'Fire Sprinkler',
        description: 'Install fire suppression system',
        startOffset: 101, duration: 5,
        predecessor: 'Plumbing Rough-In', depType: 'FS', lag: 0, isCritical: false, milestone: false
    },

    // ===== PHASE 7: INTERIOR FINISHES =====
    {
        name: 'Interior Framing',
        description: 'Build interior partition walls',
        startOffset: 103, duration: 8,
        predecessor: 'Electrical Rough-In', depType: 'FS', lag: 0, isCritical: true, milestone: false
    },
    {
        name: 'Drywall',
        description: 'Install and finish drywall',
        startOffset: 111, duration: 10,
        predecessor: 'Interior Framing', depType: 'FS', lag: 0, isCritical: true, milestone: false
    },
    {
        name: 'Interior Painting',
        description: 'Paint all interior surfaces',
        startOffset: 121, duration: 8,
        predecessor: 'Drywall', depType: 'FS', lag: 0, isCritical: true, milestone: false
    },
    {
        name: 'Flooring Installation',
        description: 'Install tile, carpet, and hardwood',
        startOffset: 129, duration: 10,
        predecessor: 'Interior Painting', depType: 'FS', lag: 0, isCritical: true, milestone: false
    },
    {
        name: 'Cabinetry',
        description: 'Install kitchen and bathroom cabinets',
        startOffset: 129, duration: 6,
        predecessor: 'Interior Painting', depType: 'FS', lag: 0, isCritical: false, milestone: false
    },
    {
        name: 'Countertops',
        description: 'Install granite countertops',
        startOffset: 135, duration: 3,
        predecessor: 'Cabinetry', depType: 'FS', lag: 0, isCritical: false, milestone: false
    },
    {
        name: 'Interior Doors',
        description: 'Install interior doors',
        startOffset: 135, duration: 4,
        predecessor: 'Cabinetry', depType: 'SS', lag: 0, isCritical: false, milestone: false
    },

    // ===== PHASE 8: MEP FINISH =====
    {
        name: 'Electrical Fixtures',
        description: 'Install lights, outlets, switches',
        startOffset: 139, duration: 5,
        predecessor: 'Flooring Installation', depType: 'FS', lag: 0, isCritical: true, milestone: false
    },
    {
        name: 'Plumbing Fixtures',
        description: 'Install sinks, toilets, faucets',
        startOffset: 139, duration: 4,
        predecessor: 'Flooring Installation', depType: 'FS', lag: 0, isCritical: false, milestone: false
    },
    {
        name: 'HVAC Commissioning',
        description: 'Test and balance HVAC system',
        startOffset: 140, duration: 3,
        predecessor: 'HVAC Rough-In', depType: 'FS', lag: 35, isCritical: false, milestone: false
    },

    // ===== PHASE 9: EXTERIOR FINISHES =====
    {
        name: 'Exterior Painting',
        description: 'Paint exterior surfaces',
        startOffset: 105, duration: 8,
        predecessor: 'HVAC Rough-In', depType: 'FS', lag: 0, isCritical: false, milestone: false
    },
    {
        name: 'Landscaping',
        description: 'Install plants, grass, irrigation',
        startOffset: 135, duration: 7,
        predecessor: 'Exterior Painting', depType: 'FS', lag: 22, isCritical: false, milestone: false
    },
    {
        name: 'Driveway & Walkways',
        description: 'Pour concrete driveway and paths',
        startOffset: 140, duration: 4,
        predecessor: 'Landscaping', depType: 'SS', lag: 2, isCritical: false, milestone: false
    },

    // ===== PHASE 10: CLOSEOUT =====
    {
        name: 'Final Cleanup',
        description: 'Clean entire building',
        startOffset: 144, duration: 3,
        predecessor: 'Electrical Fixtures', depType: 'FS', lag: 0, isCritical: true, milestone: false
    },
    {
        name: 'Punch List',
        description: 'Complete all remaining items',
        startOffset: 147, duration: 5,
        predecessor: 'Final Cleanup', depType: 'FS', lag: 0, isCritical: true, milestone: false
    },
    {
        name: 'Final Inspection',
        description: 'City final inspection',
        startOffset: 152, duration: 2,
        predecessor: 'Punch List', depType: 'FS', lag: 0, isCritical: true, milestone: false
    },
    {
        name: 'Certificate of Occupancy',
        description: 'Receive CO from city',
        startOffset: 154, duration: 0, milestone: true,
        predecessor: 'Final Inspection', depType: 'FS', lag: 0, isCritical: true
    },
]

// Generate Excel file
function generateExcel() {
    const data: string[][] = [
        // Headers
        ['Task Name', 'Description', 'Start Date', 'End Date', 'Milestone', 'Predecessor', 'Dependency Type', 'Lag Days'],
    ]

    for (const task of tasks) {
        const startDate = addDays(PROJECT_START, task.startOffset)
        const endDate = task.milestone ? startDate : addDays(startDate, task.duration - 1)

        data.push([
            task.name,
            task.description,
            formatDate(startDate),
            formatDate(endDate),
            task.milestone ? 'Yes' : 'No',
            task.predecessor,
            task.depType || '',
            task.lag.toString(),
        ])
    }

    // Create workbook
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(data)

    // Set column widths
    worksheet['!cols'] = [
        { wch: 28 },  // Task Name
        { wch: 40 },  // Description
        { wch: 12 },  // Start Date
        { wch: 12 },  // End Date
        { wch: 10 },  // Milestone
        { wch: 50 },  // Predecessor
        { wch: 15 },  // Dependency Type
        { wch: 10 },  // Lag Days
    ]

    XLSX.utils.book_append_sheet(workbook, worksheet, 'WBS Tasks')

    // Write to file
    const outputPath = path.join(__dirname, '../../..', 'sample-wbs-import.xlsx')
    XLSX.writeFile(workbook, outputPath)

    console.log(`✅ Excel file generated: ${outputPath}`)
    console.log(`📊 Total tasks: ${tasks.length}`)
    console.log(`🏁 Milestones: ${tasks.filter(t => t.milestone).length}`)
    console.log(`🔥 Critical path tasks: ${tasks.filter(t => t.isCritical).length}`)

    // Print critical path
    console.log('\n🔴 CRITICAL PATH:')
    tasks.filter(t => t.isCritical).forEach((t, i) => {
        const prefix = t.milestone ? '🏁' : '  '
        console.log(`${prefix} ${i + 1}. ${t.name}`)
    })

    console.log('\n📅 Project Duration: ~154 days (5 months)')
    console.log('📅 Start: December 16, 2024')
    console.log('📅 End (CO): May 19, 2025')
}

generateExcel()
