'use client'

import * as React from "react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, isBefore, isAfter, parseISO, isValid } from "date-fns"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minDate?: string
  maxDate?: string
  disabled?: boolean
}

// Helper to safely parse date string
const safeParseISO = (dateStr: string | undefined): Date | undefined => {
  if (!dateStr) return undefined
  const parsed = parseISO(dateStr)
  return isValid(parsed) ? parsed : undefined
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  minDate,
  maxDate,
  disabled
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const initialDate = React.useMemo(() => safeParseISO(value) || new Date(), [value])
  const [currentMonth, setCurrentMonth] = React.useState<Date>(initialDate)

  const selectedDate = React.useMemo(() => safeParseISO(value), [value])
  const min = React.useMemo(() => safeParseISO(minDate), [minDate])
  const max = React.useMemo(() => safeParseISO(maxDate), [maxDate])

  // Re-sync current month when value changes from outside
  React.useEffect(() => {
    const parsed = safeParseISO(value)
    if (parsed) {
      setCurrentMonth(parsed)
    }
  }, [value])


  const days = React.useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const calendarStart = startOfWeek(monthStart)
    const calendarEnd = endOfWeek(monthEnd)

    return eachDayOfInterval({
      start: calendarStart,
      end: calendarEnd,
    })
  }, [currentMonth])

  const handlePreviousMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const handleDateSelect = (date: Date) => {
    if (disabledDate(date)) return
    onChange(format(date, "yyyy-MM-dd"))
    setIsOpen(false)
  }

  const disabledDate = (date: Date) => {
    if (min && isBefore(date, min) && !isSameDay(date, min)) return true
    if (max && isAfter(date, max) && !isSameDay(date, max)) return true
    return false
  }

  const clearDate = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange("")
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-10 px-3",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
          {value ? format(parseISO(value), "PPP") : <span>{placeholder}</span>}
          {value && !disabled && (
            <X
              className="ml-auto h-4 w-4 opacity-50 hover:opacity-100"
              onClick={clearDate}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={handlePreviousMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={handleNextMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-2">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <div key={day} className="w-8">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              const isSelected = selectedDate && isSameDay(day, selectedDate)
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isDisabled = disabledDate(day)

              return (
                <button
                  key={idx}
                  onClick={() => handleDateSelect(day)}
                  disabled={isDisabled}
                  className={cn(
                    "h-8 w-8 rounded-md text-sm transition-colors flex items-center justify-center",
                    isSelected
                      ? "bg-primary text-primary-foreground hover:bg-primary"
                      : isCurrentMonth
                        ? "hover:bg-accent hover:text-accent-foreground"
                        : "text-muted-foreground/50 hover:bg-accent hover:text-accent-foreground",
                    isDisabled && "opacity-20 cursor-not-allowed hover:bg-transparent",
                    isSameDay(day, new Date()) && !isSelected && "border border-primary/50"
                  )}
                >
                  {format(day, "d")}
                </button>
              )
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
