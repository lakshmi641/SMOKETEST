'use client'

import React from 'react'
import { Shield, Check, Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PERMISSION_METADATA, getPermissionsByCategory } from '@/lib/constants/permissions'
import { ROLE_CONFIGS, CoreRole } from '@/lib/constants/role-permissions'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function RoleManagement() {
  const coreRoles: CoreRole[] = ['admin', 'manager', 'employee']
  const permissionCategories = ['workspace', 'project', 'task', 'user', 'company', 'analytics', 'workflow', 'admin'] as const

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-gray-900">Roles & Permissions</h2>
        <p className="text-gray-600">
          View the core system roles and their associated permissions.
          <span className="ml-1 text-amber-600 font-medium inline-flex items-center gap-1">
            <Info className="h-4 w-4" />
            Editing permissions is currently disabled.
          </span>
        </p>
      </div>

      <Tabs defaultValue="admin" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          {coreRoles.map((roleKey) => (
            <TabsTrigger key={roleKey} value={roleKey} className="capitalize font-semibold">
              {ROLE_CONFIGS[roleKey].displayName}
            </TabsTrigger>
          ))}
        </TabsList>

        {coreRoles.map((roleKey) => {
          const roleConfig = ROLE_CONFIGS[roleKey]
          const rolePermissions = roleConfig.permissions

          return (
            <TabsContent key={roleKey} value={roleKey} className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
              <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0 pt-0 pb-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-2xl flex items-center gap-2">
                        <Shield className="h-6 w-6 text-primary" />
                        {roleConfig.displayName} Role
                      </CardTitle>
                      <CardDescription className="text-base">{roleConfig.description}</CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1">
                      System Defined
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-0">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left side: Summary & Categories (4 cols) */}
                    <div className="lg:col-span-4 space-y-6">
                      <div className="bg-muted/30 rounded-xl p-6 border border-border/50 space-y-4">
                        <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                          <Info className="h-4 w-4 text-primary" />
                          Permission Statistics
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="bg-background border shadow-sm">
                            {rolePermissions.length} Active Permissions
                          </Badge>
                          {permissionCategories.map(category => {
                            const count = getPermissionsByCategory(category as any)
                              .filter(p => rolePermissions.includes(p)).length
                            if (count === 0) return null
                            return (
                              <Badge key={category} variant="outline" className="capitalize bg-background font-normal">
                                {category}: {count}
                              </Badge>
                            )
                          })}
                        </div>
                      </div>

                      <div className="bg-card rounded-xl p-6 border border-border/50 space-y-6 shadow-sm">
                        <h4 className="font-semibold text-sm border-b pb-3 text-foreground">Functional Coverage</h4>
                        <div className="space-y-5">
                          {permissionCategories.map(category => {
                            const categoryPermissions = getPermissionsByCategory(category as any)
                            const totalInCategory = categoryPermissions.length
                            const roleInCategory = categoryPermissions.filter(p => rolePermissions.includes(p)).length

                            if (totalInCategory === 0) return null

                            const percentage = Math.round((roleInCategory / totalInCategory) * 100)

                            return (
                              <div key={category} className="space-y-2">
                                <div className="flex justify-between text-xs font-medium">
                                  <span className="capitalize text-muted-foreground">{category}</span>
                                  <span className="text-foreground">{roleInCategory} <span className="text-muted-foreground/60 text-[10px]">/ {totalInCategory}</span></span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2">
                                  <div
                                    className="bg-primary h-2 rounded-full transition-all duration-500 ease-in-out"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Right side: Detailed List (8 cols) */}
                    <div className="lg:col-span-8 bg-card rounded-xl border border-border/50 shadow-sm flex flex-col h-[650px]">
                      <div className="bg-muted/30 px-6 py-4 border-b flex items-center justify-between">
                        <h4 className="font-semibold text-sm text-foreground">Detailed Permissions Matrix</h4>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Read-Only View</span>
                      </div>
                      <ScrollArea className="flex-1">
                        <Table>
                          <TableHeader className="bg-muted/20 sticky top-0 z-10 backdrop-blur-sm">
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-[60px] text-center">Status</TableHead>
                              <TableHead className="w-[200px]">Permission Name</TableHead>
                              <TableHead>Functional Description</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {permissionCategories.map(category => {
                              const categoryPermissions = getPermissionsByCategory(category as any)
                              const matchedPermissions = categoryPermissions.filter(p => rolePermissions.includes(p))

                              if (matchedPermissions.length === 0) return null

                              return (
                                <React.Fragment key={category}>
                                  <TableRow className="bg-muted/10 hover:bg-muted/10 border-none">
                                    <TableCell colSpan={3} className="py-2 px-6 text-[10px] font-black uppercase tracking-widest text-primary/70 bg-primary/5">
                                      {category} Domain
                                    </TableCell>
                                  </TableRow>
                                  {categoryPermissions.map(permissionId => {
                                    const metadata = PERMISSION_METADATA[permissionId]
                                    if (!metadata) return null
                                    const isEnabled = rolePermissions.includes(permissionId)

                                    return (
                                      <TableRow key={permissionId} className={isEnabled ? "" : "opacity-40 grayscale-[0.5]"}>
                                        <TableCell className="text-center p-3">
                                          {isEnabled ? (
                                            <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-1 w-6 h-6 flex items-center justify-center mx-auto border border-green-200 dark:border-green-800">
                                              <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                            </div>
                                          ) : (
                                            <div className="bg-muted rounded-full p-1 w-6 h-6 flex items-center justify-center mx-auto border border-border/50">
                                              <span className="text-[10px] text-muted-foreground">OFF</span>
                                            </div>
                                          )}
                                        </TableCell>
                                        <TableCell className="font-semibold text-sm py-4">
                                          {metadata.name}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground py-4 leading-normal">
                                          {metadata.description}
                                        </TableCell>
                                      </TableRow>
                                    )
                                  })}
                                </React.Fragment>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
