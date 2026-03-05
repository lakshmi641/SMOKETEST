'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { getPositions } from '@/lib/services/org/org-services'
import { Position } from '@/types/org-schema'
import { useCompany } from '@/contexts/CompanyContext'

interface PositionSelectProps {
    value?: string
    onValueChange: (value: string, position?: Position) => void
    placeholder?: string
    disabled?: boolean
    className?: string
}

export function PositionSelect({
    value,
    onValueChange,
    placeholder = "Select position...",
    disabled = false,
    className,
}: PositionSelectProps) {
    const [open, setOpen] = React.useState(false)
    const [positions, setPositions] = React.useState<Position[]>([])
    const [loading, setLoading] = React.useState(false)
    const [searchValue, setSearchValue] = React.useState("")
    const { companyId, groupId } = useCompany()

    React.useEffect(() => {
        if (companyId) {
            const loadPositions = async () => {
                try {
                    setLoading(true)
                    const data = await getPositions(companyId, groupId ?? undefined)
                    setPositions(data)
                } catch (error) {
                    console.error('Error loading positions in PositionSelect:', error)
                } finally {
                    setLoading(false)
                }
            }
            loadPositions()
        }
    }, [companyId])

    const selectedPosition = React.useMemo(
        () => positions.find((p) => p.id === value),
        [positions, value]
    )

    const filteredPositions = React.useMemo(() => {
        const search = searchValue.toLowerCase()
        return positions.filter(p =>
            !search ||
            (p.title || "").toLowerCase().includes(search) ||
            (p.code || "").toLowerCase().includes(search)
        )
    }, [positions, searchValue])

    return (
        <Popover open={open} onOpenChange={setOpen} modal={true}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled || loading}
                    className={cn("w-full h-11 justify-between font-normal bg-white border-slate-200", className)}
                >
                    <div className="flex items-center gap-2 truncate">
                        {selectedPosition ? (
                            <>
                                <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                    <Briefcase className="h-3.5 w-3.5" />
                                </div>
                                <span className="font-medium text-slate-700">{selectedPosition.title}</span>
                                {selectedPosition.code && (
                                    <span className="text-xs text-slate-400 ml-1">
                                        ({selectedPosition.code})
                                    </span>
                                )}
                            </>
                        ) : (
                            <span className="text-slate-400">
                                {loading ? "Loading positions..." : placeholder}
                            </span>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0 z-[10001] shadow-2xl border-slate-200"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <Command shouldFilter={false} className="max-h-[500px]">
                    <CommandInput
                        placeholder="Search by title or code..."
                        value={searchValue}
                        onValueChange={setSearchValue}
                        className="h-11 border-none focus:ring-0"
                    />
                    <CommandList className="max-h-[400px]">
                        {filteredPositions.length === 0 && (
                            <CommandEmpty className="py-6 text-slate-500 text-center">
                                {loading ? 'Fetching positions...' : 'No positions found.'}
                            </CommandEmpty>
                        )}
                        <CommandGroup className="px-2">
                            {filteredPositions.map((position) => (
                                <CommandItem
                                    key={position.id}
                                    value={position.id}
                                    onSelect={() => {
                                        onValueChange(position.id, position)
                                        setOpen(false)
                                        setSearchValue("")
                                    }}
                                    className="flex items-center gap-3 py-3 px-2 cursor-pointer aria-selected:bg-slate-50 rounded-lg transition-colors group"
                                >
                                    <div className={cn(
                                        "flex items-center justify-center h-8 w-8 rounded-full border border-slate-100",
                                        value === position.id ? "bg-amber-100 border-amber-200" : "bg-slate-50"
                                    )}>
                                        <Briefcase className={cn(
                                            "h-4 w-4",
                                            value === position.id ? "text-amber-600" : "text-slate-400"
                                        )} />
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="font-semibold text-sm truncate text-slate-700">{position.title}</span>
                                        <span className="text-[11px] text-slate-500 truncate">{position.code || 'No code'}</span>
                                    </div>
                                    {value === position.id && (
                                        <Check className="h-4 w-4 text-emerald-500" />
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
