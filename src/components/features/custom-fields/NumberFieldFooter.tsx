'use client'

import { useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProjectCustomFields } from '@/hooks/useProjectCustomFields'
import { CustomFieldService } from '@/lib/services/custom-field-service'
import type {
  ProjectCustomFieldWithDefinition,
  AggregationType,
  NumberFormat,
} from '@/types/custom-field'
import type { GeneratedTask } from '@/types/task-template-schema'

interface NumberFieldFooterProps {
  field: ProjectCustomFieldWithDefinition
  tasks: GeneratedTask[]
  companyId: string
  projectId: string
}

const AGGREGATION_OPTIONS: Array<{ value: AggregationType; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
]

export function NumberFieldFooter({
  field,
  tasks,
  companyId,
  projectId,
}: NumberFieldFooterProps) {
  const { updateAggregation } = useProjectCustomFields(projectId, companyId)

  const aggregation = field.aggregation || 'sum'
  const definition = field.definition

  // Calculate aggregation value
  const aggregationValue = useMemo(() => {
    return CustomFieldService.calculateAggregation(
      field.id,
      aggregation,
      tasks
    )
  }, [field.id, aggregation, tasks])

  // Format the result based on field settings
  const formatNumber = (num: number): string => {
    if (isNaN(num)) return '-'

    const decimals = definition.decimals ?? 0
    const formatted = num.toFixed(decimals)

    switch (definition.format) {
      case 'percent':
        return `${formatted}%`
      case 'currency':
        return `$${formatted}`
      case 'custom':
        return `${formatted} ${definition.customLabel || ''}`
      case 'none':
        return formatted
      default:
        return formatted
    }
  }

  const handleAggregationChange = async (newAggregation: AggregationType) => {
    try {
      await updateAggregation(field.id, newAggregation)
    } catch (error) {
      console.error('Error updating aggregation:', error)
    }
  }

  const displayValue =
    aggregationValue !== null ? formatNumber(aggregationValue) : '-'

  return (
    <div className="flex items-center gap-2 min-w-[150px]">
      <Select
        value={aggregation}
        onValueChange={(value) => handleAggregationChange(value as AggregationType)}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AGGREGATION_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {aggregation !== 'none' && (
        <span className="text-sm font-medium text-muted-foreground">
          {displayValue}
        </span>
      )}
    </div>
  )
}

