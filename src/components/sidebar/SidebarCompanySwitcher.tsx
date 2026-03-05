'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Building2, Check, ChevronDown } from 'lucide-react'
import { useCompany } from '@/contexts/CompanyContext'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SidebarCompanySwitcherProps {
  isCollapsed: boolean
  /** When true, rendered inside the sidebar top bar (reduced padding) */
  inHeader?: boolean
}

/**
 * Always shows the selected company in the sidebar.
 * When the user has multiple companies, renders as a dropdown (switcher).
 * When only one company, shows the same block without dropdown/chevron.
 */
export function SidebarCompanySwitcher({ isCollapsed, inHeader }: SidebarCompanySwitcherProps) {
  const router = useRouter()
  const { userCompanies, currentCompany, switchCompany, isLoading } = useCompany()
  const [logoError, setLogoError] = useState(false)

  const hasMultipleCompanies = userCompanies.length > 1
  const logoUrl = currentCompany?.branding?.logo
  const showLogo = logoUrl && !logoError

  // Reset logo error when company changes
  useEffect(() => {
    setLogoError(false)
  }, [currentCompany?.id, logoUrl])

  const handleSwitch = async (companyId: string) => {
    if (companyId === currentCompany?.id) return
    await switchCompany(companyId)
    router.push('/')
  }

  const companyBlock = (
    <div
      className={cn(
        'w-full h-9 flex items-center text-muted-foreground border-0 rounded-md',
        isCollapsed ? 'justify-center px-0' : 'justify-between px-3',
        hasMultipleCompanies && 'hover:text-foreground hover:bg-accent cursor-pointer'
      )}
    >
      {isCollapsed ? (
        <div className="flex items-center justify-center w-8 h-8">
          {showLogo ? (
            // eslint-disable-next-line -- dynamic logo URLs may be from any domain
            <img
              src={logoUrl}
              alt={currentCompany?.name || 'Company logo'}
              width={32}
              height={32}
              className="object-contain max-h-8 max-w-8 rounded"
              onError={() => setLogoError(true)}
            />
          ) : (
            <Building2 className="h-5 w-5 flex-shrink-0" />
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded overflow-hidden bg-muted">
              {showLogo ? (
                // eslint-disable-next-line -- dynamic logo URLs may be from any domain
                <img
                  src={logoUrl}
                  alt={currentCompany?.name || 'Company logo'}
                  width={24}
                  height={24}
                  className="object-contain w-6 h-6"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <span className="truncate text-sm font-medium text-foreground">
              {currentCompany?.name ?? 'Company'}
            </span>
          </div>
          {hasMultipleCompanies && (
            <ChevronDown className="h-4 w-4 flex-shrink-0 ml-1 text-muted-foreground" />
          )}
        </>
      )}
    </div>
  )

  if (isLoading || !currentCompany) {
    return null
  }

  const wrapperClass = cn(
    inHeader ? 'px-0' : 'px-2 pb-2',
    isCollapsed && 'px-1 flex justify-center'
  )

  if (hasMultipleCompanies) {
    return (
      <div className={wrapperClass}>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 w-full p-0 border-0 hover:bg-transparent">
                  {companyBlock}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side={isCollapsed ? 'right' : 'bottom'}>
              <p>Switch company</p>
              {isCollapsed && currentCompany && (
                <p className="font-medium text-foreground">{currentCompany.name}</p>
              )}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            align={isCollapsed ? 'center' : 'start'}
            side={isCollapsed ? 'right' : 'bottom'}
            sideOffset={6}
            className="min-w-[12rem]"
          >
            {userCompanies.map((company) => (
              <DropdownMenuItem
                key={company.id}
                onClick={() => handleSwitch(company.id)}
                className="gap-2 cursor-pointer"
              >
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded overflow-hidden bg-muted">
                  {company.branding?.logo ? (
                    // eslint-disable-next-line -- dynamic logo URLs may be from any domain
                    <img
                      src={company.branding.logo}
                      alt=""
                      width={24}
                      height={24}
                      className="object-contain w-6 h-6"
                    />
                  ) : (
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
                <span className="truncate flex-1">{company.name}</span>
                {company.id === currentCompany?.id && (
                  <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <div className={wrapperClass}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default">{companyBlock}</div>
        </TooltipTrigger>
        <TooltipContent side={isCollapsed ? 'right' : 'bottom'}>
          <p className="font-medium text-foreground">{currentCompany.name}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
