'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Shield } from 'lucide-react'
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
import { RoleService } from '@/lib/services/access-control/role-service'
import { Role } from '@/types/access-control-schema'
import { useCompany } from '@/contexts/CompanyContext'

interface RoleSelectProps {
    value?: string
    onValueChange: (value: string, role?: Role) => void
    placeholder?: string
    disabled?: boolean
    className?: string
}

export function RoleSelect({
    value,
    onValueChange,
    placeholder = "Select role...",
    disabled = false,
    className,
}: RoleSelectProps) {
    const [open, setOpen] = React.useState(false)
    const [roles, setRoles] = React.useState<Role[]>([])
    const [loading, setLoading] = React.useState(false)
    const [searchValue, setSearchValue] = React.useState("")
    const { companyId, groupId } = useCompany()

    React.useEffect(() => {
        if (companyId) {
            const loadRoles = async () => {
                try {
                    setLoading(true)
                    const data = await RoleService.getRoles(groupId ?? companyId ?? '', companyId)
                    setRoles(data)
                } catch (error) {
                    console.error('Error loading roles in RoleSelect:', error)
                } finally {
                    setLoading(false)
                }
            }
            loadRoles()
        }
    }, [companyId, groupId])

    const selectedRole = React.useMemo(
        () => roles.find((r) => r.id === value),
        [roles, value]
    )

    const filteredRoles = React.useMemo(() => {
        const search = searchValue.toLowerCase()
        return roles.filter(r =>
            !search ||
            (r.name || "").toLowerCase().includes(search)
        )
    }, [roles, searchValue])

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
                        {selectedRole ? (
                            <>
                                <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                    <Shield className="h-3.5 w-3.5" />
                                </div>
                                <span className="font-medium text-slate-700">{selectedRole.name}</span>
                            </>
                        ) : (
                            <span className="text-slate-400">
                                {loading ? "Loading roles..." : placeholder}
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
                        placeholder="Search by role name..."
                        value={searchValue}
                        onValueChange={setSearchValue}
                        className="h-11 border-none focus:ring-0"
                    />
                    <CommandList className="max-h-[400px]">
                        {filteredRoles.length === 0 && (
                            <CommandEmpty className="py-6 text-slate-500 text-center">
                                {loading ? 'Fetching roles...' : 'No roles found.'}
                            </CommandEmpty>
                        )}
                        <CommandGroup className="px-2">
                            {filteredRoles.map((role) => (
                                <CommandItem
                                    key={role.id}
                                    value={role.id}
                                    onSelect={() => {
                                        onValueChange(role.id, role)
                                        setOpen(false)
                                        setSearchValue("")
                                    }}
                                    className="flex items-center gap-3 py-3 px-2 cursor-pointer aria-selected:bg-slate-50 rounded-lg transition-colors group"
                                >
                                    <div className={cn(
                                        "flex items-center justify-center h-8 w-8 rounded-full border border-slate-100",
                                        value === role.id ? "bg-amber-100 border-amber-200" : "bg-slate-50"
                                    )}>
                                        <Shield className={cn(
                                            "h-4 w-4",
                                            value === role.id ? "text-amber-600" : "text-slate-400"
                                        )} />
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="font-semibold text-sm truncate text-slate-700">{role.name}</span>
                                        <span className="text-[11px] text-slate-500 truncate">{role.scope}</span>
                                    </div>
                                    {value === role.id && (
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
