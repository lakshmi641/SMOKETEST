'use client'

import { useState, useEffect } from 'react'
import { Settings2, FileText, Bell, ArrowLeft, Loader2 } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { NotificationConfigCard } from '@/components/settings/NotificationConfigCard'
import { UserNotificationSettings } from '@/components/notifications/UserNotificationSettings'
import { TemplateDesignerV3 } from '@/components/templates/TemplateDesignerV3'
import { TemplateList } from '@/components/templates/TemplateList'
import { TemplateService } from '@/lib/services/external-notifications/template-service'
import { useAuthStore } from '@/store/authStore'
import { useCompanyId, useGroupId } from '@/contexts/CompanyContext'
import { useCompany } from '@/contexts/CompanyContext'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { CompanyTemplate, TemplateType } from '@/types/external-notifications'

type NotificationSection = 'configuration' | 'templates' | 'preferences'

const sections = [
  { id: 'configuration' as const, label: 'Configuration', icon: Settings2, adminOnly: true },
  { id: 'templates' as const, label: 'Templates', icon: FileText, adminOnly: true },
  { id: 'preferences' as const, label: 'My Preferences', icon: Bell, adminOnly: false },
]

export default function NotificationSettingsPage() {
  const { user } = useAuthStore()
  const companyId = useCompanyId()
  const groupId = useGroupId()
  const { currentCompanyUser } = useCompany()

  const isAdmin = currentCompanyUser?.role &&
    ['owner', 'admin', 'group_admin'].includes(currentCompanyUser.role)

  const [activeSection, setActiveSection] = useState<NotificationSection>(
    isAdmin ? 'configuration' : 'preferences'
  )

  const [templates, setTemplates] = useState<CompanyTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<CompanyTemplate | null>(null)
  const [creatingType, setCreatingType] = useState<TemplateType | null>(null)
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)

  useEffect(() => {
    if (companyId && activeSection === 'templates') {
      loadTemplates()
    }
  }, [companyId, groupId, activeSection])

  useEffect(() => {
    if (!isAdmin && (activeSection === 'configuration' || activeSection === 'templates')) {
      setActiveSection('preferences')
    }
  }, [isAdmin, activeSection])

  const loadTemplates = async () => {
    try {
      setIsLoadingTemplates(true)
      const data = await TemplateService.getAllTemplates(companyId!, groupId ?? undefined)
      setTemplates(data)
    } catch (error) {
      console.error('Failed to load templates:', error)
      toast.error('Failed to load notification templates')
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  const handleCreateTemplate = (type: TemplateType) => {
    setCreatingType(type)
    setSelectedTemplate(null)
  }

  const handleEditTemplate = (template: CompanyTemplate) => {
    setSelectedTemplate(template)
    setCreatingType(null)
  }

  const handleSaveTemplate = async (templateData: Partial<CompanyTemplate>) => {
    try {
      if (!companyId || !user) return

      const existingId = selectedTemplate?.id || templateData.id

      if (existingId) {
        await TemplateService.updateTemplate(companyId, existingId, {
          ...templateData,
          lastModifiedBy: user.id
        }, groupId ?? undefined)
        toast.success('Changes saved')
      } else {
        const newTemplate = await TemplateService.createTemplate(companyId, {
          ...templateData,
          createdBy: user.id,
          lastModifiedBy: user.id
        } as any, groupId ?? undefined)
        toast.success('Template created')
        setSelectedTemplate(newTemplate)
        setCreatingType(null)
      }

      await loadTemplates()
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save')
    }
  }

  const handleBackToTemplateList = () => {
    setSelectedTemplate(null)
    setCreatingType(null)
    loadTemplates()
  }

  const visibleSections = sections.filter(s => !s.adminOnly || isAdmin)

  const isEditingTemplate = selectedTemplate || creatingType

  return (
    <DashboardLayout>
      <div>
        <div className="mb-6">
          <p className="text-muted-foreground">Configure notification providers, templates, and preferences</p>
        </div>

        <Tabs
          value={activeSection}
          onValueChange={(value) => {
            const section = value as NotificationSection
            setActiveSection(section)
            if (section !== 'templates') {
              setSelectedTemplate(null)
              setCreatingType(null)
            }
          }}
          className="w-full"
        >
          <TabsList className="w-full h-auto flex flex-wrap gap-6 p-0 bg-transparent border-b border-border rounded-none mb-6 justify-start">
            {visibleSections.map((section) => (
              <TabsTrigger
                key={section.id}
                value={section.id}
                className="flex items-center gap-2 px-0 py-3 text-sm font-medium text-muted-foreground rounded-none border-b-2 border-transparent -mb-px data-[state=active]:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-foreground"
              >
                <section.icon className="w-4 h-4 shrink-0" />
                {section.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="configuration" className="mt-0">
            {isAdmin && <NotificationConfigCard />}
          </TabsContent>

          <TabsContent value="templates" className="mt-0">
            {isAdmin && (
              <>
                {isLoadingTemplates ? (
                  <div className="flex h-[40vh] items-center justify-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                ) : isEditingTemplate ? (
                  <div className="animate-in fade-in duration-300">
                    <div className="px-4 py-3 mb-4 border border-border rounded-lg bg-card flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleBackToTemplateList}
                        className="h-8 text-xs font-bold uppercase tracking-wider"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                      </Button>
                      <div className="w-px h-6 bg-border" />
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {selectedTemplate ? `Editing ${selectedTemplate.type}` : `New ${creatingType}`}
                      </span>
                    </div>
                    <TemplateDesignerV3
                      companyId={companyId!}
                      groupId={groupId ?? undefined}
                      templateType={creatingType || selectedTemplate?.type || 'email'}
                      initialTemplate={selectedTemplate || undefined}
                      onSave={handleSaveTemplate}
                    />
                  </div>
                ) : (
                  <TemplateList
                    templates={templates}
                    onEdit={handleEditTemplate}
                    onCreateNew={handleCreateTemplate}
                  />
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="preferences" className="mt-0">
            <div className="max-w-4xl">
              <UserNotificationSettings />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
