import * as XLSX from 'xlsx';
import { ImportType, getSchemaForImportType } from './types/import-types';

/**
 * Template Download Service
 * Generates and downloads sample Excel templates for different import types
 */
export class TemplateDownloadService {
    /**
     * Download a sample Excel template for the given import type
     */
    static downloadTemplate(importType: ImportType, options?: { excludeProjectName?: boolean }) {
        const schema = getSchemaForImportType(importType);
        const excludeProjectName = options?.excludeProjectName ?? false;

        // 1. Create headers - Respect excludeProjectName option
        const headers = [...schema.required, ...schema.optional].filter(h => {
            // Only exclude Project Name if explicitly requested (usually when inside a project context)
            if (excludeProjectName && ['Project Name', 'Project', 'projectName'].includes(h)) {
                return false;
            }
            return true;
        });

        // 2. Create sample data
        const sampleData = this.getSampleData(importType);

        // 3. Create worksheet
        const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });

        // 4. Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");

        // 5. Generate filename
        const filename = `${importType.replace('_', '-')}-template.xlsx`;

        // 6. Trigger download
        XLSX.writeFile(wb, filename);
    }

    /**
     * Get sample data rows for the template
     */
    private static getSampleData(importType: ImportType): any[] {
        let data: any[] = [];
        switch (importType) {
            case 'project_tasks':
                data = [
                    {
                        'Task Name': 'Example Project Task',
                        'Description': 'This is a sample task description',
                        'Status': 'todo',
                        'Priority': 'medium',
                        'Due Date': '2024-12-31',
                        'Assigned User': 'John Doe'
                    }
                ];
                break;
            case 'wbs_gantt':
                data = [
                    {
                        'Task Name': 'Project Kickoff',
                        'Description': 'Project initiation meeting with stakeholders',
                        'Status': 'done',
                        'Priority': 'high',
                        'Start Date': '2024-01-01',
                        'End Date': '2024-01-01',
                        'Milestone': 'Yes',
                        'Predecessor': '',
                        'Dep Type': '',
                        'Lag Days': 0,

                        'Task Type': 'Management',
                        'Requirement Type': 'Internal',
                        'Assigned User': 'john.doe@example.com',
                        'Reporter': 'admin@example.com',
                        'Estimated Hours': 2
                    },
                    {
                        'Task Name': 'Requirements Analysis',
                        'Description': 'Gather and document all requirements',
                        'Status': 'in_progress',
                        'Priority': 'high',
                        'Start Date': '2024-01-02',
                        'End Date': '2024-01-10',
                        'Milestone': 'No',
                        'Predecessor': 'Project Kickoff',
                        'Dep Type': 'FS',
                        'Lag Days': 0,

                        'Task Type': 'Technical',
                        'Requirement Type': 'Functional',
                        'Assigned User': 'jane.smith@example.com',
                        'Reporter': 'john.doe@example.com',
                        'Estimated Hours': 40
                    }
                ];
                break;
            case 'recurring_tasks':
                data = [
                    {
                        'Task Name': 'Weekly Status Report',
                        'Description': 'Fill out the weekly report',
                        'Project Name': 'Sample Project',
                        'Frequency': 'weekly',
                        'Interval': 1,
                        'Week Days': 'Friday',
                        'Timezone': 'Asia/Kolkata',
                        'Assignment Type': 'Specific User',
                        'Assigned User': 'Admin User',
                        'End Type': 'Never'
                    }
                ];
                break;
            default:
                data = [{}];
        }

        return data;
    }
}
