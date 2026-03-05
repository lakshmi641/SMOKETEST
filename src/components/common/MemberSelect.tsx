'use client'

import * as React from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { UserService } from '@/lib/services/users/user-services'
import * as OrgService from '@/lib/services/org/org-services'
import { User } from '@/types/index'
import { Position } from '@/types/org-schema'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { EntityLookupService } from '@/lib/services/import/entity-lookup-service'

export type MemberType = 'user' | 'position'

export interface MemberSelection {
    type: MemberType
    id: string
    label?: string // Name or Position Title
    subLabel?: string // Email or "Position"
    userId?: string // User ID when position is selected
    userName?: string // User name for display
}

interface PositionWithUsers {
    position: Position
    users: User[]
}

interface MemberSelectProps {
    value?: MemberSelection
    onValueChange: (selection: MemberSelection | undefined) => void
    placeholder?: string
    loading?: boolean
    disabled?: boolean
    className?: string
    includePositions?: boolean
    allowedPositionIds?: string[] // Filter positions to only these IDs
    includeUsers?: boolean // Whether to show users in the dropdown
    workspaceId?: string // Optional: filter by workspace
    /** When set, only show users (and positions with users) in this list, e.g. project team member IDs */
    allowedUserIds?: string[]
    /** Users with avatar/name for display on initial load (e.g. project users) so assignee avatar shows before dropdown fetch */
    initialUsers?: Array<{ id: string; name?: string; email?: string; avatar?: string }>
    /** Controlled open state (e.g. when used inside another popover so parent can open dropdown on click) */
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function MemberSelect({
    value,
    onValueChange,
    placeholder = "Select member...",
    loading: providedLoading,
    disabled = false,
    className,
    includePositions = true,
    allowedPositionIds,
    includeUsers = true,
    workspaceId,
    allowedUserIds,
    initialUsers,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
}: MemberSelectProps) {
    const [internalOpen, setInternalOpen] = React.useState(false)
    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = React.useCallback((next: boolean) => {
        if (isControlled) {
            controlledOnOpenChange?.(next)
        } else {
            setInternalOpen(next)
        }
    }, [isControlled, controlledOnOpenChange])
    const [users, setUsers] = React.useState<any[]>([])
    const [allUsers, setAllUsers] = React.useState<any[]>([])
    const [positions, setPositions] = React.useState<any[]>([])
    const [orgUnits, setOrgUnits] = React.useState<any[]>([])
    const [positionsWithUsers, setPositionsWithUsers] = React.useState<PositionWithUsers[]>([])
    const [fetching, setFetching] = React.useState(false)
    const [searchValue, setSearchValue] = React.useState("")
    const { companyId, groupId } = useCompany()
    const { user: currentUser } = useAuthStore()

    React.useEffect(() => {
        // When we need positions, we require groupId to be available as a non-empty string
        const needsGroupId = includePositions
        const hasValidGroupId = typeof groupId === 'string' && groupId.length > 0
        const hasRequiredData = companyId && (!needsGroupId || hasValidGroupId)

        if (hasRequiredData && open) {
            const loadData = async () => {
                try {
                    setFetching(true)
                    const [usersData, allCompanyUsers, positionsData, orgUnitsData] = await Promise.all([
                        workspaceId
                            ? EntityLookupService.fetchWorkspaceUsers(companyId, workspaceId, groupId ?? undefined)
                            : UserService.getUsers(companyId, groupId ?? undefined, { mergeCompanyProfiles: true }),
                        UserService.getUsers(companyId, groupId ?? undefined, { mergeCompanyProfiles: true }),
                        includePositions && hasValidGroupId ? OrgService.getPositions(companyId, groupId) : Promise.resolve([]),
                        includePositions && hasValidGroupId ? OrgService.getOrgUnits(companyId, groupId) : Promise.resolve([])
                    ])
                    setUsers(usersData)
                    setAllUsers(allCompanyUsers)
                    setPositions(positionsData)
                    setOrgUnits(orgUnitsData)

                    // Fetch users for each position
                    if (includePositions && hasValidGroupId && positionsData.length > 0) {
                        const positionsWithUsersData = await Promise.all(
                            positionsData.map(async (position) => {
                                try {
                                    const userIds = await OrgService.getUsersByPosition(companyId, position.id, groupId)
                                    // If we are in a workspace context (usersData is filtered), only include those users
                                    // Otherwise use allCompanyUsers
                                    const contextUsers = workspaceId ? usersData : allCompanyUsers
                                    const positionUsers = contextUsers.filter(u => userIds.includes(u.id))
                                    return { position, users: positionUsers }
                                } catch (error) {
                                    console.error(`Error loading users for position ${position.id}:`, error)
                                    return { position, users: [] }
                                }
                            })
                        )
                        setPositionsWithUsers(positionsWithUsersData)
                    }
                } catch (error) {
                    console.error('Error loading members:', error)
                } finally {
                    setFetching(false)
                }
            }
            loadData()
        }
    }, [companyId, open, includePositions, workspaceId, groupId])

    const effectiveUsers = React.useMemo(() => {
        let list = [...users]
        // Apply allowedUserIds filter first
        if (allowedUserIds !== undefined) {
            const idSet = new Set(allowedUserIds)
            list = list.filter(u => idSet.has(u.id))
        }

        // Only inject currentUser if: no filter is active, OR current user is in the allowed list
        if (currentUser?.id && !list.some(u => u.id === currentUser.id)) {
            if (allowedUserIds === undefined || allowedUserIds.includes(currentUser.id)) {
                list = [{
                    id: currentUser.id,
                    email: currentUser.email ?? '',
                    name: currentUser.name ?? 'You',
                    role: currentUser.role ?? 'employee',
                    position: currentUser.position ?? '',
                    orgUnitId: currentUser.orgUnitId,
                    orgUnitName: currentUser.orgUnitName,
                    avatar: currentUser.avatar ?? null,
                    skills: currentUser.skills ?? [],
                    contact: currentUser.contact ?? { phone: '', slack: '' },
                } as User, ...list]
            }
        }
        return list
    }, [users, currentUser, allowedUserIds])

    const effectiveAllUsers = React.useMemo(() => {
        const list = [...allUsers]
        if (currentUser?.id && !list.some(u => u.id === currentUser.id)) {
            list.unshift({
                id: currentUser.id,
                email: currentUser.email ?? '',
                name: currentUser.name ?? 'You',
                role: currentUser.role ?? 'employee',
                position: currentUser.position ?? '',
                orgUnitId: currentUser.orgUnitId,
                orgUnitName: currentUser.orgUnitName,
                avatar: currentUser.avatar ?? null,
                skills: currentUser.skills ?? [],
                contact: currentUser.contact ?? { phone: '', slack: '' },
            } as User)
        }
        return list
    }, [allUsers, currentUser])

    const selectedLabel = React.useMemo(() => {
        if (!value) return null
        if (value.type === 'user') {
            const user = effectiveUsers.find(u => u.id === value.id) ?? initialUsers?.find(u => u.id === value.id)
            return user ? (user.name ?? user.email) : value.label || 'Unknown User'
        } else {
            const posWithUsers = positionsWithUsers.find(p => p.position.id === value.id)
            if (posWithUsers) {
                const userCount = posWithUsers.users.length
                const userNames = posWithUsers.users.map(u => u.name).join(', ')
                if (userCount > 1) {
                    return `${posWithUsers.position.title} (${userCount})`
                }
                return userNames || posWithUsers.position.title
            }
            // Prefer user name for display; fallback to name part after " | " if label is "title | name"
            const nameOnly = value.userName || (value.label && value.label.includes(' | ')
                ? value.label.split(' | ').pop()?.trim()
                : value.label)
            const pos = positions.find(p => p.id === value.id)
            return nameOnly || (pos ? pos.title : null) || 'Unknown'
        }
    }, [value, effectiveUsers, initialUsers, positions, positionsWithUsers])

    const selectedUserForAvatar = React.useMemo(() => {
        if (!value) return null
        const fromInitial = (userId: string) => initialUsers?.find(u => u.id === userId)
        if (value.type === 'user') return effectiveUsers.find(u => u.id === value.id) ?? effectiveAllUsers.find(u => u.id === value.id) ?? fromInitial(value.id) ?? null
        if (value.type === 'position' && value.userId) return effectiveUsers.find(u => u.id === value.userId) ?? effectiveAllUsers.find(u => u.id === value.userId) ?? fromInitial(value.userId) ?? null
        return null
    }, [value, effectiveUsers, effectiveAllUsers, initialUsers])

    const avatarInitials = React.useMemo(() => {
        if (!selectedLabel) return '?'
        const parts = String(selectedLabel).trim().split(/\s+/)
        if (parts.length >= 2) return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase()
        return selectedLabel.charAt(0).toUpperCase()
    }, [selectedLabel])



    const filteredUsers = React.useMemo(() => {
        const search = searchValue.toLowerCase()
        return effectiveUsers.filter(u =>
            !search ||
            (u.name || "").toLowerCase().includes(search) ||
            (u.email || "").toLowerCase().includes(search)
        )
    }, [effectiveUsers, searchValue])

    const filteredPositionsWithUsers = React.useMemo(() => {
        const search = searchValue.toLowerCase()
        let filtered = positionsWithUsers.filter(pwu => {
            const matchesSearch = !search ||
                (pwu.position.title || "").toLowerCase().includes(search) ||
                pwu.users.some(u =>
                    (u.name || "").toLowerCase().includes(search) ||
                    (u.email || "").toLowerCase().includes(search)
                )
            return matchesSearch
        })
        // Filter by allowed position IDs if provided
        if (allowedPositionIds !== undefined) {
            filtered = filtered.filter(pwu => allowedPositionIds.includes(pwu.position.id))
        }

        // When filtering by allowedUserIds (e.g. project team), only show positions that have at least one of those users
        if (allowedUserIds !== undefined && allowedUserIds.length > 0) {
            const idSet = new Set(allowedUserIds)
            if (currentUser?.id) idSet.add(currentUser.id)
            filtered = filtered.filter(pwu => pwu.users.some(u => idSet.has(u.id)))
        }

        // If filtering by workspace, hide empty positions (vacant in this workspace)
        // This ensures we only show positions that are actually held by workspace members
        if (workspaceId) {
            filtered = filtered.filter(pwu => pwu.users.length > 0)
        }

        return filtered
    }, [positionsWithUsers, searchValue, allowedPositionIds, allowedUserIds, currentUser?.id])

    return (
        <Popover open={open} onOpenChange={setOpen} modal={true}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                        className
                    )}
                >
                    <div className="flex items-center gap-2 truncate min-w-0">
                        {value ? (
                            <>
                                <Avatar className="h-6 w-6 shrink-0 ring-2 ring-background">
                                    <AvatarImage src={(selectedUserForAvatar as any)?.avatar ?? undefined} alt="" />
                                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                        {avatarInitials}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-foreground truncate">{selectedLabel}</span>
                            </>
                        ) : (
                            <span className="text-muted-foreground">
                                {fetching ? "Loading..." : placeholder}
                            </span>
                        )}
                    </div>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[300px] p-0 z-[10001]"
                align="start"
            >
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Search users or positions..."
                        value={searchValue}
                        onValueChange={setSearchValue}
                    />
                    <CommandList>
                        {fetching && (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                Loading...
                            </div>
                        )}
                        {!fetching && filteredPositionsWithUsers.length === 0 && filteredUsers.length === 0 && (
                            <CommandEmpty>No results found.</CommandEmpty>
                        )}

                        {includePositions && filteredPositionsWithUsers.length > 0 && (
                            <CommandGroup heading="Positions">
                                {filteredPositionsWithUsers.map((pwu) => {
                                    const userNames = pwu.users.map(u => u.name).join(', ')
                                    const displayTitle = userNames || 'No users assigned'
                                    const displaySub = pwu.position.title

                                    return (
                                        <CommandItem
                                            key={pwu.position.id}
                                            value={pwu.position.id}
                                            onSelect={() => {
                                                // SMART RESOLUTION: Try to find a user matching the name hint in the title
                                                const titleParts = pwu.position.title.split(' - ')
                                                const nameHint = titleParts.length > 1 ? titleParts.pop()?.trim() : null

                                                let resolvedUserId = pwu.users[0]?.id
                                                let resolvedUserName = userNames

                                                if (nameHint && nameHint.length > 1) {
                                                    const matchedUser = effectiveAllUsers.find(u =>
                                                        u.name?.toLowerCase().includes(nameHint.toLowerCase()) ||
                                                        (u as any).displayName?.toLowerCase().includes(nameHint.toLowerCase())
                                                    )
                                                    if (matchedUser) {
                                                        resolvedUserId = matchedUser.id
                                                        resolvedUserName = matchedUser.name || matchedUser.displayName || nameHint
                                                    }
                                                }

                                                onValueChange({
                                                    type: 'position',
                                                    id: pwu.position.id,
                                                    label: resolvedUserName || pwu.position.title,
                                                    subLabel: 'Position',
                                                    userId: resolvedUserId,
                                                    userName: resolvedUserName
                                                })
                                                setOpen(false)
                                                setSearchValue("")
                                            }}
                                            className="gap-2"
                                        >
                                            <div className="flex items-center justify-center h-6 w-6 rounded bg-purple-100 border border-purple-200 text-purple-600 font-mono text-[10px] font-bold">
                                                P
                                            </div>
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="truncate font-medium text-foreground">{displayTitle}</span>
                                                <span className="text-[10px] text-muted-foreground truncate italic">
                                                    {displaySub} {pwu.position.code && `| ${pwu.position.code}`}
                                                </span>
                                                {pwu.position.orgUnitId && (
                                                    <span className="text-[10px] text-muted-foreground truncate">
                                                        {orgUnits.find(ou => ou.id === pwu.position.orgUnitId)?.name || 'Unknown Unit'}
                                                    </span>
                                                )}
                                            </div>
                                            {value?.id === pwu.position.id && value?.type === 'position' && (
                                                <Check className="ml-auto h-4 w-4 flex-shrink-0" />
                                            )}
                                        </CommandItem>
                                    )
                                })}
                            </CommandGroup>
                        )}

                        {includePositions && filteredPositionsWithUsers.length > 0 && includeUsers && <CommandSeparator />}

                        {includeUsers && filteredUsers.length > 0 && (
                            <CommandGroup heading="Users">
                                {filteredUsers.map((user) => (
                                    <CommandItem
                                        key={user.id}
                                        value={user.id}
                                        onSelect={() => {
                                            onValueChange({
                                                type: 'user',
                                                id: user.id,
                                                label: user.name,
                                                subLabel: user.email
                                            })
                                            setOpen(false)
                                            setSearchValue("")
                                        }}
                                        className="gap-2"
                                    >
                                        <div className="flex items-center justify-center h-6 w-6 rounded bg-muted border border-border text-foreground font-mono text-[10px] font-bold">
                                            {(user.name || "?").substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-foreground">{user.name}</span>
                                            <span className="text-[10px] text-foreground">{user.email}</span>
                                        </div>
                                        {value?.id === user.id && value?.type === 'user' && (
                                            <Check className="ml-auto h-4 w-4 text-foreground" />
                                        )}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
