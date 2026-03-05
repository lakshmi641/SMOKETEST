'use client'

import React, { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { User, Network, AlertTriangle, Users, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskAssignment } from '@/types/recurring-task-schema'
import { UserSelect } from '@/components/features/users/UserSelect'
import { User as UserType } from '@/types'

interface AssignmentStepProps {
    assignment: TaskAssignment
    onChange: (assignment: TaskAssignment) => void
    users?: { id: string; name: string; positionName?: string; positionId?: string }[]
    positions?: any[]
    loading?: boolean
    errors?: Record<string, string>
}

export function AssignmentStep({
    assignment,
    onChange,
    users = [],
    positions = [],
    loading,
    errors,
}: AssignmentStepProps) {

    // Helper to get candidates for a position
    const getCandidates = (posId: string) => {
        const pos = positions.find(p => p.id === posId)
        if (!pos) return []
        const title = pos.title || pos.name || ''
        return users.filter(u =>
            // Prefer positionId match (reliable); fall back to title comparison for legacy data
            (u.positionId ? u.positionId === posId : (u.positionName || '').trim().toLowerCase() === title.trim().toLowerCase())
        )
    }

    // Helper to get candidates count (wrapper)
    const getCandidatesCount = (posId: string) => getCandidates(posId).length

    // Group users by position for the Specific User dropdown
    const groupedUsers = useMemo(() => {
        const groups: Record<string, typeof users> = {}
        users.forEach(u => {
            const pos = u.positionName || 'Other'
            if (!groups[pos]) groups[pos] = []
            groups[pos].push(u)
        })
        return groups
    }, [users])

    const handleTypeChange = (type: 'specific_user' | 'position') => {
        onChange({ ...assignment, type, value: '' })
    }

    const handleValueChange = (value: string) => {
        if (assignment.type === 'position') {
            const pos = positions.find(p => p.id === value)
            const posTitle = pos?.title || pos?.name || ''
            const count = getCandidatesCount(value)

            onChange({
                ...assignment,
                value,
                positionId: value,
                positionName: posTitle,
                candidatesCount: count
            })
        } else {
            onChange({ ...assignment, value })
        }
    }

    return (
        <div className="space-y-6">
            {/* Strategy Selection */}
            <div className="space-y-3">
                <Label className="font-semibold text-slate-700">Assignment Strategy</Label>
                <RadioGroup
                    value={assignment.type}
                    onValueChange={(val: any) => handleTypeChange(val)}
                    className="grid grid-cols-2 gap-4"
                >
                    <div className={cn(
                        "relative flex items-center space-x-2 rounded-xl border-2 p-4 cursor-pointer hover:bg-slate-50 transition-all",
                        assignment.type === 'specific_user' ? "border-amber-500 bg-amber-50/50 shadow-sm" : "border-slate-100"
                    )}>
                        <RadioGroupItem value="specific_user" id="strat-user" className="text-amber-500" />
                        <Label htmlFor="strat-user" className="cursor-pointer flex items-center gap-2 font-medium">
                            <User className="h-4 w-4 text-slate-500" />
                            Specific User
                        </Label>
                    </div>

                    <div className={cn(
                        "relative flex items-center space-x-2 rounded-xl border-2 p-4 cursor-pointer hover:bg-slate-50 transition-all",
                        assignment.type === 'position' ? "border-amber-500 bg-amber-50/50 shadow-sm" : "border-slate-100"
                    )}>
                        <RadioGroupItem value="position" id="strat-pos" className="text-amber-500" />
                        <Label htmlFor="strat-pos" className="cursor-pointer flex items-center gap-2 font-medium">
                            <Network className="h-4 w-4 text-slate-500" />
                            Position / Role
                        </Label>
                    </div>
                </RadioGroup>
            </div>

            {/* Dynamic Input based on selection */}
            <div className="space-y-4 min-h-[100px]">
                <div className="space-y-2">
                    <Label className="font-semibold text-slate-700">
                        {assignment.type === 'specific_user' ? 'Select Team Member' : 'Select Position'}
                    </Label>

                    {assignment.type === 'specific_user' ? (
                        <UserSelect
                            value={assignment.value}
                            onValueChange={handleValueChange}
                            users={users as any[]}
                            loading={loading}
                            placeholder="Search team member..."
                        />
                    ) : (
                        <Select value={assignment.value} onValueChange={handleValueChange}>
                            <SelectTrigger className="h-11 bg-white border-slate-200">
                                <SelectValue placeholder="Select a position..." />
                            </SelectTrigger>
                            <SelectContent position="popper" sideOffset={4} className="max-h-[300px] w-[var(--radix-select-trigger-width)]">
                                {positions.filter(p => getCandidates(p.id).length > 0).map(p => {
                                    const candidates = getCandidates(p.id)
                                    const count = candidates.length
                                    return (
                                        <SelectItem key={p.id} value={p.id}>
                                            <div className="flex items-center justify-between w-full min-w-[200px] gap-4">
                                                <span className="font-medium truncate">{p.title || p.name}</span>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
                                                    {count > 0 && (
                                                        <span className="max-w-[120px] truncate hidden sm:inline-block">
                                                            {candidates.map(c => c.name).join(', ')}
                                                        </span>
                                                    )}
                                                    <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                                        <Users className="h-3 w-3 text-slate-400" />
                                                        <span>{count}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </SelectItem>
                                    )
                                })}
                            </SelectContent>
                        </Select>
                    )}

                    {assignment.type === 'position' && assignment.value && (
                        <div className="mt-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-slate-500 italic flex items-center gap-1.5 font-medium">
                                    <InfoIcon className="h-3.5 w-3.5" />
                                    Assigned to current role holders:
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                {(() => {
                                    const candidates = getCandidates(assignment.value);
                                    if (candidates.length === 0) {
                                        return (
                                            <div className="col-span-2 py-4 text-center border-2 border-dashed border-slate-100 rounded-xl text-slate-400 text-xs italic">
                                                No members currently in this position
                                            </div>
                                        )
                                    }
                                    return candidates.map(u => (
                                        <button
                                            key={u.id}
                                            type="button"
                                            onClick={() => {
                                                onChange({
                                                    ...assignment,
                                                    type: 'specific_user',
                                                    value: u.id,
                                                    positionId: assignment.value,
                                                    positionName: u.positionName,
                                                    candidatesCount: candidates.length
                                                });
                                            }}
                                            className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white shadow-sm hover:border-amber-200 hover:bg-amber-50/30 transition-all text-left group"
                                        >
                                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors">
                                                <User className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-bold text-slate-700 truncate leading-none mb-1">{u.name}</p>
                                                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold uppercase tracking-tight group-hover:text-amber-600">
                                                    <span>Assign Specifically</span>
                                                    <ChevronRight className="h-2.5 w-2.5" />
                                                </div>
                                            </div>
                                        </button>
                                    ))
                                })()}
                            </div>
                        </div>
                    )}
                </div>

                {errors?.value && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                        <AlertTriangle className="h-4 w-4" />
                        <span>{errors.value}</span>
                    </div>
                )}
            </div>
        </div>
    )
}

function InfoIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
        </svg>
    )
}
