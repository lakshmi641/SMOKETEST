// Built-in fields that can be used in formulas
// These are system fields from the task schema

import type { GeneratedTask } from '@/types/task-template-schema';
import type { BuiltInField } from '@/types/formula';

/**
 * Get value from a built-in field
 */
type BuiltInFieldGetter = (task: GeneratedTask) => string | number | null;

/**
 * Extended built-in field with getter function
 */
interface BuiltInFieldWithGetter extends BuiltInField {
    getValue: BuiltInFieldGetter;
}

/**
 * All built-in fields available for formulas
 */
export const BUILT_IN_FIELDS: BuiltInFieldWithGetter[] = [
    // Date fields
    {
        id: 'dueDate',
        name: 'Due date',
        type: 'date',
        icon: 'calendar',
        description: 'The due date of the task',
        getValue: (task) => task.dueDate || null,
    },
    {
        id: 'startDate',
        name: 'Start date',
        type: 'date',
        icon: 'calendar',
        description: 'The start date of the task',
        getValue: (task) => task.startDate || null,
    },
    {
        id: 'endDate',
        name: 'End date',
        type: 'date',
        icon: 'calendar',
        description: 'The end date of the task',
        getValue: (task) => task.endDate || null,
    },

    {
        id: 'createdAt',
        name: 'Created on',
        type: 'date',
        icon: 'calendar',
        description: 'When the task was created',
        getValue: (task) => task.createdAt || null,
    },
    {
        id: 'completedAt',
        name: 'Completed on',
        type: 'date',
        icon: 'calendar',
        description: 'When the task was completed',
        getValue: (task) => task.completedAt ?? null,
    },
    {
        id: 'today',
        name: 'Today',
        type: 'date',
        icon: 'calendar',
        description: 'The current date',
        getValue: () => new Date().toISOString().split('T')[0] || null,
    },

    // Number fields
    {
        id: 'estimatedHours',
        name: 'Estimated hours',
        type: 'number',
        icon: 'hash',
        description: 'Estimated hours to complete',
        getValue: (task) => task.estimatedHours ?? null,
    },
    {
        id: 'actualHours',
        name: 'Actual hours',
        type: 'number',
        icon: 'hash',
        description: 'Actual hours spent',
        getValue: (task) => task.actualHours ?? null,
    },
    {
        id: 'progress',
        name: 'Progress',
        type: 'number',
        icon: 'hash',
        description: 'Task progress (0-100)',
        getValue: (task) => task.progress ?? null,
    },
];

/**
 * Get a built-in field by ID
 */
export function getBuiltInField(id: string): BuiltInFieldWithGetter | undefined {
    return BUILT_IN_FIELDS.find((field) => field.id === id);
}

/**
 * Check if a field ID is a built-in field
 */
export function isBuiltInField(id: string): boolean {
    return BUILT_IN_FIELDS.some((field) => field.id === id);
}

/**
 * Get the value of a built-in field from a task
 */
export function getBuiltInFieldValue(
    fieldId: string,
    task: GeneratedTask
): string | number | null {
    const field = getBuiltInField(fieldId);
    if (!field) return null;
    return field.getValue(task);
}
