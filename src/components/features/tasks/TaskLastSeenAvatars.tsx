import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Eye } from "lucide-react"

interface TaskLastSeenAvatarsProps {
    lastSeenBy: Record<string, string>
    users: Array<{ id: string, name: string, avatar?: string }>
    currentUserId?: string
}

export function TaskLastSeenAvatars({ lastSeenBy, users, currentUserId }: TaskLastSeenAvatarsProps) {
    // Filter out current user and sort by most recent
    const seenUsers = Object.entries(lastSeenBy)
        .filter(([userId]) => userId !== currentUserId)
        .sort(([, a], [, b]) => new Date(b).getTime() - new Date(a).getTime())

    if (seenUsers.length === 0) return null

    const formatLastSeenTime = (dateString: string) => {
        try {
            const date = new Date(dateString)
            if (isNaN(date.getTime())) return ''

            // Format: "last seen @ Feb 20, 3:30 PM IST"
            const timeString = new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: true,
                timeZone: 'Asia/Kolkata'
            }).format(date)

            return `last seen @ ${timeString} IST`
        } catch (e) {
            return ''
        }
    }

    return (
        <TooltipProvider>
            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                    <div className="group flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 p-1.5 rounded-md transition-colors">
                        <Eye className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary">
                            {seenUsers.length}
                        </span>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" className="w-80 p-0 overflow-hidden shadow-xl border-slate-200">
                    <div className="px-4 py-3 border-b bg-muted/50">
                        <h4 className="font-semibold text-sm">Seen by:</h4>
                    </div>
                    <ScrollArea className="max-h-[300px]">
                        <div className="p-2 grid gap-1">
                            {seenUsers.map(([userId, seenAt]) => {
                                const user = users.find(u => u.id === userId)
                                if (!user) return null

                                return (
                                    <div key={userId} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={user.avatar} alt={user.name} />
                                            <AvatarFallback className="text-xs">{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-medium leading-none">{user.name}</span>
                                            <span className="text-[10px] text-muted-foreground font-medium">
                                                {formatLastSeenTime(seenAt)}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </ScrollArea>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
