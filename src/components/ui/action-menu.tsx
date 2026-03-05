import * as React from "react"
import { MoreHorizontal, Edit, Trash2, Eye, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export interface ActionMenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: "default" | "destructive"
  disabled?: boolean
}

export interface ActionMenuProps {
  items: ActionMenuItem[]
  className?: string
  size?: "sm" | "default"
}

export const ActionMenu: React.FC<ActionMenuProps> = ({
  items,
  className,
  size = "default"
}) => {
  const [open, setOpen] = React.useState(false)

  const handleItemClick = (onClick: () => void) => {
    onClick()
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={size === "sm" ? "sm" : "icon"}
          className={cn(
            size === "sm" ? "h-8 w-8 p-0" : "h-8 w-8 p-0",
            className
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {items.map((item, index) => (
          <React.Fragment key={index}>
            <DropdownMenuItem
              onClick={() => handleItemClick(item.onClick)}
              disabled={item.disabled}
              className={cn(
                "cursor-pointer",
                item.variant === "destructive" && "text-destructive focus:text-destructive"
              )}
            >
              {item.icon && <span className="mr-2">{item.icon}</span>}
              {item.label}
            </DropdownMenuItem>
            {index < items.length - 1 && <DropdownMenuSeparator />}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Predefined action items for common operations
export const createViewAction = (onClick: () => void): ActionMenuItem => ({
  label: "View Details",
  icon: <Eye className="h-4 w-4" />,
  onClick
})

export const createEditAction = (onClick: () => void): ActionMenuItem => ({
  label: "Edit",
  icon: <Edit className="h-4 w-4" />,
  onClick
})

export const createDeleteAction = (onClick: () => void): ActionMenuItem => ({
  label: "Delete",
  icon: <Trash2 className="h-4 w-4" />,
  onClick,
  variant: "destructive"
})

export const createDuplicateAction = (onClick: () => void): ActionMenuItem => ({
  label: "Duplicate",
  icon: <Copy className="h-4 w-4" />,
  onClick
})
