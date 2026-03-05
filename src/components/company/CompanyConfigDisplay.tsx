'use client'

import { useCompanyConfig } from '@/hooks/useCompanyConfig'

export function CompanyConfigDisplay() {
  const companyConfig = useCompanyConfig()
  return (
    <div className="bg-card rounded-lg shadow p-6 mb-6 border border-border">
      <h3 className="text-lg font-semibold text-foreground mb-4">Company Configuration</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium text-foreground">Company Information</h4>
          <p className="text-sm text-muted-foreground">Name: {companyConfig.name}</p>
          <p className="text-sm text-muted-foreground">Industry: {companyConfig.industry}</p>
          <p className="text-sm text-muted-foreground">Description: {companyConfig.description}</p>
        </div>
        <div>
          <h4 className="font-medium text-foreground">Equipment Types</h4>
          <div className="flex flex-wrap gap-1">
            {companyConfig.equipmentTypes?.map((type, index) => (
              <span key={index} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-xs rounded">
                {type}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-medium text-foreground">Manufacturing Phases</h4>
          <div className="flex flex-wrap gap-1">
            {companyConfig.manufacturingPhases?.map((phase, index) => (
              <span key={index} className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs rounded">
                {phase}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-medium text-foreground">Quality Standards</h4>
          <div className="flex flex-wrap gap-1">
            {companyConfig.qualityStandards?.map((standard, index) => (
              <span key={index} className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 text-xs rounded">
                {standard}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
