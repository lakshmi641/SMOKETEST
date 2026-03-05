import { useState, useCallback } from 'react'
import type { ExecutiveFilters } from '@/types/executive-dashboard'
import { subDays } from 'date-fns'

const defaultFilters: ExecutiveFilters = {
    viewScope: 'organization',
    dateRange: {
        start: subDays(new Date(), 30),
        end: new Date(),
        label: 'Last 30 Days'
    }
}

export function useExecutiveFilters() {
    const [viewScope, setViewScope] = useState<ExecutiveFilters['viewScope']>(defaultFilters.viewScope)
    const [dateRange, setDateRange] = useState<ExecutiveFilters['dateRange']>(defaultFilters.dateRange)

    const resetFilters = useCallback(() => {
        setViewScope(defaultFilters.viewScope)
        setDateRange(defaultFilters.dateRange)
    }, [])

    return {
        viewScope,
        dateRange,
        setViewScope,
        setDateRange,
        resetFilters
    }
}
