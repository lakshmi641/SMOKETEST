import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const outputDir = path.join(process.cwd(), 'sample_imports');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// 1. Project Tasks / My Tasks
const projectTasks = [
    { 'Task Name': 'Design System Overhaul', 'Project Name': 'PMS', 'Description': 'Update all components to design v3', 'Priority': 'high', 'Due Date': '2025-01-15', 'Assigned User': 'Sathwik Kumar', 'Category': 'design', 'Department': 'Engineering' },
    { 'Task Name': 'Database Migration', 'Project Name': 'PMS', 'Description': 'Move legacy data to Cloud Firestore', 'Priority': 'urgent', 'Due Date': '2025-01-10', 'Assigned User': 'Divya Singh', 'Category': 'manufacturing', 'Department': 'IT' },
    { 'Task Name': 'User Interview Phase 1', 'Project Name': 'PMS', 'Description': 'Collect feedback from 5 key clients', 'Priority': 'medium', 'Due Date': '2025-01-20', 'Assigned User': 'Ravi Kumar', 'Category': 'custom', 'Department': 'Product' },
    { 'Task Name': 'API Security Audit', 'Project Name': 'PMS', 'Description': 'Penetration testing on auth endpoints', 'Priority': 'high', 'Due Date': '2025-01-25', 'Assigned User': 'Anil Kumar', 'Category': 'testing', 'Department': 'Security' },
    { 'Task Name': 'Marketing Campaign Assets', 'Project Name': 'PMS', 'Description': 'Banners and videos for Jan launch', 'Priority': 'low', 'Due Date': '2025-01-05', 'Assigned User': 'Priya Sharma', 'Category': 'custom', 'Department': 'Marketing' },
    { 'Task Name': 'Performance Optimization', 'Project Name': 'PMS', 'Description': 'Reduce bundle size by 30%', 'Priority': 'medium', 'Due Date': '2025-02-01', 'Assigned User': 'Sathwik Kumar', 'Category': 'development', 'Department': 'Engineering' },
    { 'Task Name': 'HR Policy Update', 'Project Name': 'PMS', 'Description': 'Revise remote work guidelines', 'Priority': 'low', 'Due Date': '2025-01-30', 'Assigned User': 'Sunita Rao', 'Category': 'custom', 'Department': 'HR' },
    { 'Task Name': 'Q1 Financial Report', 'Project Name': 'PMS', 'Description': 'Complete balance sheets for Q1', 'Priority': 'high', 'Due Date': '2025-04-15', 'Assigned User': 'Rahul Jain', 'Category': 'custom', 'Department': 'Finance' },
    { 'Task Name': 'Compliance Training', 'Project Name': 'PMS', 'Description': 'Mandatory training for all staff', 'Priority': 'medium', 'Due Date': '2025-01-15', 'Assigned User': 'Divya Singh', 'Category': 'custom', 'Department': 'Legal' },
    { 'Task Name': 'NPS Survey Analysis', 'Project Name': 'PMS', 'Description': 'Summarize recent survey results', 'Priority': 'low', 'Due Date': '2025-02-10', 'Assigned User': 'Priya Sharma', 'Category': 'custom', 'Department': 'Customer Success' }
];

// 2. WBS Gantt Tasks (Global Expansion Project)
const wbsTasks = [
    {
        'Task Name': 'Market Research', 'Project Name': 'Global Expansion 2026', 'Description': 'Comprehensive research on emerging markets',
        'Start Date': '2026-01-01', 'End Date': '2026-01-08', 'Priority': 'high', 'Assigned User': 'Sathwik Kumar',
        'Category': 'compliance', 'Department': 'Product', 'Team': 'Strategy', 'Task Type': 'Project', 'Requirement Type': 'Audit',
        'Milestone': 'no', 'Estimated Hours': 8
    },
    {
        'Task Name': 'Competitor Analysis', 'Project Name': 'Global Expansion 2026', 'Description': 'Deep dive into local competitors in SE Asia',
        'Start Date': '2026-01-09', 'End Date': '2026-01-16', 'Priority': 'medium', 'Assigned User': 'Divya Singh',
        'Category': 'operational', 'Department': 'Sales', 'Team': 'Market Intelligence', 'Task Type': 'Project', 'Requirement Type': 'Internal',
        'Predecessor': 'Market Research', 'Milestone': 'no', 'Estimated Hours': 16
    },
    {
        'Task Name': 'Local Partners Search', 'Project Name': 'Global Expansion 2026', 'Description': 'Identifying and vetting potential regional partners',
        'Start Date': '2026-01-09', 'End Date': '2026-01-20', 'Priority': 'high', 'Assigned User': 'Ravi Kumar',
        'Category': 'operational', 'Department': 'Partnerships', 'Team': 'Strategy', 'Task Type': 'Project', 'Requirement Type': 'Internal',
        'Predecessor': 'Market Research', 'Milestone': 'no', 'Estimated Hours': 24
    },
    {
        'Task Name': 'Legal Compliance Audit', 'Project Name': 'Global Expansion 2026', 'Description': 'Ensure all local laws are met',
        'Start Date': '2026-01-17', 'End Date': '2026-02-01', 'Priority': 'urgent', 'Assigned User': 'Anil Kumar',
        'Category': 'compliance', 'Department': 'Legal', 'Team': 'Compliance Unit', 'Task Type': 'Compliance', 'Requirement Type': 'Legal',
        'Predecessor': 'Competitor Analysis', 'Milestone': 'no', 'Estimated Hours': 32
    },
    {
        'Task Name': 'Marketing Strategy', 'Project Name': 'Global Expansion 2026', 'Description': 'Finalize the go-to-market plan',
        'Start Date': '2026-01-21', 'End Date': '2026-02-05', 'Priority': 'medium', 'Assigned User': 'Priya Sharma',
        'Category': 'custom', 'Department': 'Marketing', 'Team': 'Creative', 'Task Type': 'Project', 'Requirement Type': 'Quality',
        'Predecessor': 'Competitor Analysis, Local Partners Search', 'Milestone': 'no', 'Estimated Hours': 16
    },
    {
        'Task Name': 'Budget Approval', 'Project Name': 'Global Expansion 2026', 'Description': 'Secure funding for the launch phase',
        'Start Date': '2026-02-02', 'End Date': '2026-02-10', 'Priority': 'high', 'Assigned User': 'Rahul Jain',
        'Category': 'onboarding', 'Department': 'Finance', 'Team': 'Execution', 'Task Type': 'Project', 'Requirement Type': 'Audit',
        'Predecessor': 'Legal Compliance Audit', 'Milestone': 'no', 'Estimated Hours': 8
    },
    {
        'Task Name': 'Supply Chain Setup', 'Project Name': 'Global Expansion 2026', 'Description': 'Logistics and vendor coordination',
        'Start Date': '2026-01-21', 'End Date': '2026-02-15', 'Priority': 'high', 'Assigned User': 'Sunita Rao',
        'Category': 'manufacturing', 'Department': 'Operations', 'Team': 'Supply Chain', 'Task Type': 'Project', 'Requirement Type': 'Internal',
        'Predecessor': 'Local Partners Search', 'Milestone': 'no', 'Estimated Hours': 40
    },
    {
        'Task Name': 'IT Infrastructure Deployment', 'Project Name': 'Global Expansion 2026', 'Description': 'Server and cloud setup for the region',
        'Start Date': '2026-02-16', 'End Date': '2026-03-01', 'Priority': 'urgent', 'Assigned User': 'Anil Kumar',
        'Category': 'development', 'Department': 'IT', 'Team': 'Infrastructure', 'Task Type': 'Project', 'Requirement Type': 'Safety',
        'Predecessor': 'Budget Approval, Supply Chain Setup', 'Milestone': 'no', 'Estimated Hours': 24
    },
    {
        'Task Name': 'Recruitment Drive', 'Project Name': 'Global Expansion 2026', 'Description': 'Hiring local talent for the new office',
        'Start Date': '2026-03-02', 'End Date': '2026-03-25', 'Priority': 'high', 'Assigned User': 'Divya Singh',
        'Category': 'onboarding', 'Department': 'HR', 'Team': 'Strategy', 'Task Type': 'Project', 'Requirement Type': 'Quality',
        'Predecessor': 'Marketing Strategy, IT Infrastructure Deployment', 'Milestone': 'no', 'Estimated Hours': 48
    },
    {
        'Task Name': 'Global Launch Event', 'Project Name': 'Global Expansion 2026', 'Description': 'Official launch in the new territory',
        'Start Date': '2026-03-26', 'End Date': '2026-03-26', 'Priority': 'urgent', 'Assigned User': 'Sathwik Kumar',
        'Category': 'project', 'Department': 'Management', 'Team': 'Leadership', 'Task Type': 'Project', 'Requirement Type': 'Audit',
        'Predecessor': 'Recruitment Drive', 'Milestone': 'yes', 'Estimated Hours': 8
    }
];

// 3. Recurring Tasks
const recurringTasks = [
    { 'Task Name': 'Daily Standup', 'Project Name': 'PMS', 'Description': 'Sync with the team on daily progress', 'Frequency': 'daily', 'Assignment Type': 'specific_user', 'Assigned User': 'Sathwik Kumar', 'Priority': 'medium', 'Estimated Hours': 0.5, 'End Type': 'never' },
    { 'Task Name': 'Weekly Product Review', 'Project Name': 'PMS', 'Description': 'Review roadmap and upcoming features', 'Frequency': 'weekly', 'Assignment Type': 'position', 'Assigned User': 'Product Manager', 'Priority': 'high', 'Estimated Hours': 1.5, 'End Type': 'never' },
    { 'Task Name': 'Monthly Security Patch', 'Project Name': 'PMS', 'Description': 'Apply latest security updates to all systems', 'Frequency': 'monthly', 'Assignment Type': 'position', 'Assigned User': 'DevOps Engineer', 'Priority': 'urgent', 'Estimated Hours': 4, 'End Type': 'never' },
    { 'Task Name': 'Quarterly Strategy Session', 'Project Name': 'PMS', 'Description': 'Plan for the next quarter', 'Frequency': 'quarterly', 'Assignment Type': 'specific_user', 'Assigned User': 'Divya Singh', 'Priority': 'high', 'Estimated Hours': 8, 'End Type': 'after_count' },
    { 'Task Name': 'Yearly Tax Filing', 'Project Name': 'PMS', 'Description': 'Complete all tax-related documentation', 'Frequency': 'yearly', 'Assignment Type': 'position', 'Assigned User': 'Finance Head', 'Priority': 'urgent', 'Estimated Hours': 16, 'End Type': 'on_date' },
    { 'Task Name': 'Bi-Weekly 1:1', 'Project Name': 'PMS', 'Description': 'Performance and feedback sync', 'Frequency': 'weekly', 'Assignment Type': 'specific_user', 'Assigned User': 'Anil Kumar', 'Priority': 'medium', 'Estimated Hours': 1, 'End Type': 'never' },
    { 'Task Name': 'Daily Database Backup', 'Project Name': 'PMS', 'Description': 'Auto-verify database backups', 'Frequency': 'daily', 'Assignment Type': 'position', 'Assigned User': 'Database Admin', 'Priority': 'high', 'Estimated Hours': 0.25, 'End Type': 'never' },
    { 'Task Name': 'Monthly Equipment Audit', 'Project Name': 'PMS', 'Description': 'Check all manufacturing equipment status', 'Frequency': 'monthly', 'Assignment Type': 'position', 'Assigned User': 'Maintenance Lead', 'Priority': 'medium', 'Estimated Hours': 6, 'End Type': 'never' },
    { 'Task Name': 'Weekly Team Lunch', 'Project Name': 'PMS', 'Description': 'Casual team sync over lunch', 'Frequency': 'weekly', 'Assignment Type': 'specific_user', 'Assigned User': 'Priya Sharma', 'Priority': 'low', 'Estimated Hours': 1, 'End Type': 'never' },
    { 'Task Name': 'Quarterly Newsletter', 'Project Name': 'PMS', 'Description': 'Publish company updates to all employees', 'Frequency': 'quarterly', 'Assignment Type': 'position', 'Assigned User': 'HR Manager', 'Priority': 'low', 'Estimated Hours': 4, 'End Type': 'after_count' }
];

function createExcel(data: any[], fileName: string) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    const filePath = path.join(outputDir, fileName);
    XLSX.writeFile(wb, filePath);
    console.log(`Generated: ${filePath}`);
}

createExcel(projectTasks, 'Project_Tasks_Test.xlsx');
createExcel(projectTasks, 'My_Tasks_Test.xlsx'); // Same as project tasks
createExcel(wbsTasks, 'WBS_Gantt_Test.xlsx');
createExcel(recurringTasks, 'Recurring_Tasks_Test.xlsx');

console.log('Successfully generated all test Excel files in the sample_imports directory.');
