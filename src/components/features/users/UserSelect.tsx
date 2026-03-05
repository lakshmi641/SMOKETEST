'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, User as UserIcon } from 'lucide-react'
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
import { UserService } from '@/lib/services/users/user-services'
import { User } from '@/types'
import { useCompany } from '@/contexts/CompanyContext'

interface UserSelectProps {
    value?: string
    users?: User[]
    onValueChange: (value: string, user?: User) => void
    placeholder?: string
    loading?: boolean
    disabled?: boolean
    className?: string
}

export function UserSelect({
    value,
    users: providedUsers,
    onValueChange,
    placeholder = "Select user...",
    loading: providedLoading,
    disabled = false,
    className,
}: UserSelectProps) {
    const [open, setOpen] = React.useState(false)
    const [internalUsers, setInternalUsers] = React.useState<User[]>([])
    const [fetchingInternal, setFetchingInternal] = React.useState(false)
    const [searchValue, setSearchValue] = React.useState("")
    const { companyId, groupId } = useCompany()

    const users = providedUsers || internalUsers
    const loading = providedLoading || (providedUsers === undefined && fetchingInternal)

    React.useEffect(() => {
        if (companyId && providedUsers === undefined) {
            const loadUsers = async () => {
                try {
                    setFetchingInternal(true)
                    const data = await UserService.getUsers(companyId, groupId ?? undefined)
                    setInternalUsers(data)
                } catch (error) {
                    console.error('Error loading users in UserSelect:', error)
                } finally {
                    setFetchingInternal(false)
                }
            }
            loadUsers()
        }
    }, [companyId, groupId, providedUsers])

    const selectedUser = React.useMemo(
        () => users.find((user) => user.id === value),
        [users, value]
    )

    // Manual filtering for better control inside modals
    const filteredUsers = React.useMemo(() => {
        const search = searchValue.toLowerCase()
        return users.filter(u =>
            !search ||
            (u.name || "").toLowerCase().includes(search) ||
            (u.email || "").toLowerCase().includes(search)
        )
    }, [users, searchValue])

    // Grouping logic similar to dev branch
    const groupedUsers = React.useMemo(() => {
        const groups: Record<string, User[]> = {}
        filteredUsers.forEach(u => {
            const pos = (u as any).positionName || u.position || 'Other Team Members'
            if (!groups[pos]) groups[pos] = []
            groups[pos].push(u)
        })
        return groups
    }, [filteredUsers])

    return (
        <Popover open={open} onOpenChange={setOpen} modal={false}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled || loading}
                    className={cn(
                        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                        className
                    )}
                    onClick={(e) => {
                        // Let Radix handle the toggle, but ensure it doesn't stay open if clicked again
                        // Standard Radix PopoverTrigger asChild should toggle
                    }}
                >
                    <div className="flex items-center gap-2 truncate">
                        {selectedUser ? (
                            <>
                                <div className="h-6 w-7 rounded bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0 border border-slate-200">
                                    <span className="text-[10px] font-bold font-mono">
                                        {(selectedUser.name || selectedUser.email || "?").substring(0, 2).toUpperCase()}
                                    </span>
                                </div>
                                <span className="font-medium text-foreground">{selectedUser.name}</span>
                                <span className="text-xs text-muted-foreground ml-1 truncate">
                                    ({selectedUser.email})
                                </span>
                            </>
                        ) : (
                            <span className="text-muted-foreground">
                                {loading ? "Loading team members..." : placeholder}
                            </span>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0 z-[10001] shadow-2xl border-slate-200"
                align="start"
                side="bottom"
                sideOffset={4}
                collisionPadding={10}
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <Command shouldFilter={false} className="max-h-[min(400px,var(--radix-popover-content-available-height))]">
                    <CommandInput
                        placeholder="Search by name or email..."
                        value={searchValue}
                        onValueChange={setSearchValue}
                        className="h-11 border-none focus:ring-0"
                    />
                    <CommandList className="max-h-[min(350px,calc(var(--radix-popover-content-available-height)-50px))]">
                        {filteredUsers.length === 0 && (
                            <CommandEmpty className="py-6 text-slate-500 text-center">
                                {loading ? 'Fetching team members...' : 'No team members found.'}
                            </CommandEmpty>
                        )}
                        {Object.entries(groupedUsers).map(([position, members]) => (
                            <CommandGroup
                                key={position}
                                heading={position}
                                className="px-2"
                            >
                                {members.map((user) => (
                                    <CommandItem
                                        key={user.id}
                                        value={user.id}
                                        onSelect={() => {
                                            onValueChange(user.id, user)
                                            setOpen(false)
                                            setSearchValue("")
                                        }}
                                        className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-10 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                    >
                                        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                                            {value === user.id && (
                                                <Check className="h-4 w-4" />
                                            )}
                                        </span>
                                        <div className="flex items-center gap-3 w-full">
                                            <div className={cn(
                                                "flex items-center justify-center h-8 w-10 rounded border flex-shrink-0 font-mono",
                                                value === user.id ? "bg-amber-100 border-amber-200 text-amber-600" : "bg-muted text-muted-foreground border-border"
                                            )}>
                                                <span className="text-xs font-bold">
                                                    {(user.name || user.email || "?").substring(0, 2).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="font-medium text-sm truncate text-foreground">{user.name}</span>
                                                <span className="text-[11px] text-muted-foreground truncate">{user.email}</span>
                                            </div>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
