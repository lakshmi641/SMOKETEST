'use client'

import { useState, useEffect, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { EnterpriseGroupService } from '@/lib/services/enterprise-group-service'
import { Company, CompanyUser } from '@/types/company-schema'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Crown,
  Building2,
  Users,
  Search,
  ArrowRightLeft,
  Loader2,
  ChevronRight,
  UserCircle,
  Mail,
  Shield,
  ChevronLeft,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { TransferUserDialog } from '@/components/features/group-admin/TransferUserDialog'

export default function GroupAdminPage() {
  const { groupId, companyId: currentCompanyId } = useCompany()
  const { user: authUser } = useAuthStore()
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyUserCounts, setCompanyUserCounts] = useState<Record<string, number>>({})
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [search, setSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [transferUser, setTransferUser] = useState<CompanyUser | null>(null)

  const fetchCompanies = useCallback(async () => {
    if (!groupId) return
    try {
      setLoading(true)
      const data = await EnterpriseGroupService.getGroupCompanies(groupId)
      setCompanies(data)

      const counts: Record<string, number> = {}
      await Promise.all(data.map(async (company) => {
        try {
          const users = await EnterpriseGroupService.getCompanyUsers(groupId, company.id)
          counts[company.id] = users.length
        } catch {
          counts[company.id] = 0
        }
      }))
      setCompanyUserCounts(counts)
    } catch (err) {
      console.error('Failed to load companies:', err)
      toast.error('Failed to load companies')
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  const handleSelectCompany = async (company: Company) => {
    if (!groupId) return
    setSelectedCompany(company)
    setLoadingUsers(true)
    setUserSearch('')
    try {
      const users = await EnterpriseGroupService.getCompanyUsers(groupId, company.id)
      setCompanyUsers(users)
    } catch (err) {
      console.error('Failed to load users:', err)
      toast.error('Failed to load company users')
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleBack = () => {
    setSelectedCompany(null)
    setCompanyUsers([])
    setUserSearch('')
  }

  const handleTransferComplete = async () => {
    setTransferUser(null)
    if (!groupId) return

    if (selectedCompany) {
      const users = await EnterpriseGroupService.getCompanyUsers(groupId, selectedCompany.id)
      setCompanyUsers(users)
    }

    const counts: Record<string, number> = {}
    await Promise.all(companies.map(async (company) => {
      try {
        const users = await EnterpriseGroupService.getCompanyUsers(groupId, company.id)
        counts[company.id] = users.length
      } catch {
        counts[company.id] = 0
      }
    }))
    setCompanyUserCounts(counts)
  }

  const filteredCompanies = companies.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredUsers = companyUsers.filter(u =>
    (u.name || u.email || '').toLowerCase().includes(userSearch.toLowerCase())
  )

  const otherCompanies = companies.filter(c => c.id !== selectedCompany?.id)

  if (!groupId) {
    return (
      <DashboardLayout>
        <div>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Crown className="w-12 h-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground">Enterprise Group Required</h2>
            <p className="text-muted-foreground mt-2 max-w-md">
              Group admin features are only available for enterprise group tenants.
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!authUser?.isGroupAdmin) {
    return (
      <DashboardLayout>
        <div>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Shield className="w-12 h-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground">Access Restricted</h2>
            <p className="text-muted-foreground mt-2 max-w-md">
              Group administration is only available to users with the Group Admin role.
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
            <Crown className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Group Administration</h1>
            <p className="text-muted-foreground mt-1">
              Manage companies and transfer users across your enterprise group
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{companies.length}</p>
                <p className="text-xs text-muted-foreground">Companies</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {selectedCompany
                    ? companyUsers.length
                    : Object.values(companyUserCounts).reduce((a, b) => a + b, 0) || '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedCompany ? `Users in ${selectedCompany.name}` : 'Total users'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <ArrowRightLeft className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {selectedCompany ? otherCompanies.length : '—'}
                </p>
                <p className="text-xs text-muted-foreground">Transfer destinations</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        {!selectedCompany ? (
          /* Company List */
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Enterprise Companies
              </CardTitle>
              <CardDescription>
                Select a company to view its users and manage transfers
              </CardDescription>
              <div className="pt-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search companies..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No companies found
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredCompanies.map(company => (
                    <button
                      key={company.id}
                      onClick={() => handleSelectCompany(company)}
                      className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors text-left rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{company.name || 'Unnamed Company'}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            ID: {company.id}
                            {company.id === currentCompanyId && (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                                Current
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                          <Users className="h-3 w-3" />
                          {companyUserCounts[company.id] ?? '…'} users
                        </span>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Company Users */
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBack}
                    className="mb-2 -ml-2 text-muted-foreground"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back to companies
                  </Button>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {selectedCompany.name} — Users
                  </CardTitle>
                  <CardDescription>
                    {companyUsers.length} user{companyUsers.length !== 1 ? 's' : ''} in this company.
                    Select a user to transfer to another company.
                  </CardDescription>
                </div>
              </div>
              <div className="pt-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {userSearch ? 'No users match your search' : 'No users in this company'}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredUsers.map(user => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-full">
                          <UserCircle className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {user.name || user.displayName || 'Unknown User'}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            {user.email && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {user.email}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Shield className="h-3 w-3" />
                              {user.role || 'employee'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTransferUser(user)}
                        disabled={otherCompanies.length === 0}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
                        Transfer
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Transfer Dialog */}
      {transferUser && selectedCompany && groupId && (
        <TransferUserDialog
          open={!!transferUser}
          onClose={() => setTransferUser(null)}
          user={transferUser}
          fromCompany={selectedCompany}
          companies={otherCompanies}
          groupId={groupId}
          onTransferComplete={handleTransferComplete}
        />
      )}
    </DashboardLayout>
  )
}
