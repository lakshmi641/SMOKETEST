// Custom Field Types and Schemas
// Defines types for custom fields in project list view

import type { FormulaDefinition } from './formula';

export type CustomFieldType = 'single' | 'multi' | 'date' | 'people' | 'text' | 'number' | 'formula' | 'file';
export type CustomFieldCategory = 'General' | 'Technical' | 'Financial' | 'Other';
export type NumberFormat = 'number' | 'percent' | 'currency' | 'custom' | 'none';
export type AggregationType = 'none' | 'sum' | 'avg' | 'count' | 'min' | 'max';

export interface CustomFieldOption {
  id: string;
  label: string;
  color: string; // e.g., 'green', 'red', 'orange', 'blue', 'purple'
}

export interface CustomFieldDefinition {
  id: string;
  name: string;
  type: CustomFieldType;
  category: CustomFieldCategory;
  value: string;
  units?: string;

  // For single/multi select fields
  options?: CustomFieldOption[];

  // For number fields
  format?: NumberFormat;
  decimals?: number; // 0-6
  customLabel?: string; // For 'custom' format (e.g., 'lbs', 'kg')

  // For formula fields
  formula?: FormulaDefinition;

  // Metadata
  createdBy: string; // User ID
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  isArchived?: boolean; // Soft delete flag
}

export interface ProjectCustomField {
  id: string; // Matches customFieldDefinitions/{fieldId}
  order: number; // Display order in table (0-based)
  enabledAt: string; // ISO timestamp
  enabledBy: string; // User ID

  // Optional settings
  isRequired?: boolean;
  defaultValue?: any; // Type-specific default
  aggregation?: AggregationType; // For number fields only
}

// Joined type for UI (definition + project settings)
export interface ProjectCustomFieldWithDefinition extends ProjectCustomField {
  definition: CustomFieldDefinition;
}

// Value types per field type
export type CustomFieldValue =
  | string // single select, text, date (ISO string)
  | string[] // multi select, people
  | number // number

// Helper type guards
export function isSingleSelectValue(value: CustomFieldValue): value is string {
  return typeof value === 'string' && !Array.isArray(value);
}

export function isMultiSelectValue(value: CustomFieldValue): value is string[] {
  return Array.isArray(value);
}

export function isNumberValue(value: CustomFieldValue): value is number {
  return typeof value === 'number';
}

// Validation helpers
export function validateCustomFieldDefinition(def: Partial<CustomFieldDefinition>): string[] {
  const errors: string[] = [];

  if (!def.name || def.name.trim().length === 0) {
    errors.push('Field name is required');
  }

  if (!def.value || def.value.trim().length === 0) {
    errors.push('Value is required');
  }

  if (!def.type || !['single', 'multi', 'date', 'people', 'text', 'number', 'formula', 'file'].includes(def.type)) {
    errors.push('Valid field type is required');
  }

  if (!def.category) {
    errors.push('Field category is required');
  }

  if ((def.type === 'single' || def.type === 'multi') && def.options) {
    if (def.options.length === 0) {
      errors.push('At least one option is required for select fields');
    }
    if (def.options.length > 50) {
      errors.push('Maximum 50 options allowed');
    }
    def.options.forEach((opt, idx) => {
      if (!opt.label || opt.label.trim().length === 0) {
        errors.push(`Option ${idx + 1} label is required`);
      }
    });
  }

  if (def.type === 'number') {
    if (def.decimals !== undefined && (def.decimals < 0 || def.decimals > 6)) {
      errors.push('Decimal places must be between 0 and 6');
    }
    if (def.format && !['number', 'percent', 'currency', 'custom', 'none'].includes(def.format)) {
      errors.push('Invalid number format');
    }
    if (def.format === 'custom' && (!def.customLabel || def.customLabel.trim().length === 0)) {
      errors.push('Custom label is required for custom format');
    }
  }

  // Formula field validation
  if (def.type === 'formula') {
    if (!def.formula) {
      errors.push('Formula definition is required');
    } else {
      if (!def.formula.expression || def.formula.expression.trim().length === 0) {
        errors.push('Formula expression cannot be empty');
      }
      if (!def.formula.ast) {
        errors.push('Formula AST is invalid');
      }
    }
  }

  return errors;
}

// Extend GeneratedTask to include customFields
declare module '@/types/task-template-schema' {
  interface GeneratedTask {
    customFields?: Record<string, CustomFieldValue>;
  }
}
