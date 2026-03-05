import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onCheckedChange) {
        onCheckedChange(e.target.checked)
      }
      if (props.onChange) {
        props.onChange(e)
      }
    }

    return (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          ref={ref}
          checked={!!checked}
          onChange={handleChange}
          className={cn(
            "peer h-4 w-4 shrink-0 rounded-sm border border-gray-300 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            "checked:bg-blue-600 checked:border-blue-600",
            "appearance-none cursor-pointer",
            className
          )}
          {...props}
        />
        {!!checked && (
          <Check className="absolute h-3 w-3 text-white pointer-events-none left-0.5 top-0.5" />
        )}
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }

