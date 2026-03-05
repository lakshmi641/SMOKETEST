'use client'

import { useEffect } from 'react'
import { useCompany } from '@/contexts/CompanyContext'

export function DynamicTitle() {
  const { currentCompany } = useCompany()

  useEffect(() => {
    if (currentCompany?.name) {
      document.title = `${currentCompany.name} PMS - Project Management System`
    } else {
      document.title = 'PMS - Project Management System'
    }
  }, [currentCompany?.name])

  return null
}
