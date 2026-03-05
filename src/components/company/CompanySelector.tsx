// Simple Company Selector Component for Debugging

'use client'

import React from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { Button } from '@/components/ui/button'

export function CompanySelector() {
  const { 
    currentCompany, 
    userCompanies, 
    switchCompany, 
    isLoading, 
    error 
  } = useCompany()

  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg bg-muted/50">
        <p className="text-muted-foreground">Loading companies...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 border rounded-lg bg-destructive/10 border-destructive/20">
        <p className="text-destructive">Error: {error}</p>
      </div>
    )
  }

  if (userCompanies.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-warning/10 border-warning/20">
        <p className="text-warning-foreground">No companies found. Please create a company first.</p>
      </div>
    )
  }

  return (
    <div className="p-4 border rounded-lg bg-card">
      <h3 className="font-semibold text-card-foreground mb-2">Company Selector</h3>
      <p className="text-muted-foreground mb-2">
        Current: <strong>{currentCompany?.name || 'None'}</strong>
      </p>
      <div className="space-y-2">
        {userCompanies.map((company) => (
          <Button
            key={company.id}
            variant={currentCompany?.id === company.id ? "default" : "outline"}
            onClick={() => switchCompany(company.id)}
            className="w-full justify-start"
          >
            {company.name} ({company.domain})
          </Button>
        ))}
      </div>
    </div>
  )
}
