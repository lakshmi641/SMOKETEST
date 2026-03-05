'use client'

/**
 * Task Definition Step - Recurring Task Dialog
 * Configure basic task details like title, description, priority
 */

import React from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type { TaskDefinition } from '@/types/recurring-task-schema'

interface TaskDefinitionStepProps {
    definition: TaskDefinition
    onChange: (definition: TaskDefinition) => void
    errors?: Record<string, string>
}

export function TaskDefinitionStep({
    definition,
    onChange,
    errors,
}: TaskDefinitionStepProps) {
    const updateDefinition = (updates: Partial<TaskDefinition>) => {
        onChange({ ...definition, ...updates })
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="title">Task Title *</Label>
                <Input
                    id="title"
                    placeholder="e.g. Weekly Status Report"
                    value={definition.title}
                    onChange={(e) => updateDefinition({ title: e.target.value })}
                    className={errors?.title ? 'border-red-500' : ''}
                />
                {errors?.title && <p className="text-sm text-red-600">{errors.title}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                    id="description"
                    placeholder="What needs to be done?"
                    value={definition.description || ''}
                    onChange={(e) => updateDefinition({ description: e.target.value })}
                    rows={4}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="priority">Priority *</Label>
                    <Select
                        value={definition.priority}
                        onValueChange={(value) =>
                            updateDefinition({ priority: value as TaskDefinition['priority'] })
                        }
                    >
                        <SelectTrigger id="priority">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="estimatedHours">Estimated Hours</Label>
                    <Input
                        id="estimatedHours"
                        type="number"
                        min="0"
                        step="0.5"
                        value={definition.estimatedHours || 0}
                        onChange={(e) =>
                            updateDefinition({ estimatedHours: parseFloat(e.target.value) || 0 })
                        }
                    />
                </div>
            </div>
        </div>
    )
}
