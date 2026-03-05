import * as React from "react"
import { LayoutGrid, Table } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ViewType = "table" | "card"

export interface ViewToggleProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
  className?: string
}

const ViewToggle = React.forwardRef<HTMLDivElement, ViewToggleProps>(
  ({ currentView, onViewChange, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg border border-border bg-card p-1",
          className
        )}
      >
        <Button
          variant={currentView === "table" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewChange("table")}
          className="h-8 w-8 p-0"
        >
          <Table className="h-4 w-4" />
          <span className="sr-only">Table view</span>
        </Button>
        <Button
          variant={currentView === "card" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewChange("card")}
          className="h-8 w-8 p-0"
        >
          <LayoutGrid className="h-4 w-4" />
          <span className="sr-only">Card view</span>
        </Button>
      </div>
    )
  }
)
ViewToggle.displayName = "ViewToggle"

export { ViewToggle }
