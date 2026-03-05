'use client'

import { useState } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuthStore } from '@/store/authStore'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ImportDataDialog } from '@/components/data-management/ImportDataDialog'
import { PipelineSummary } from '@/components/data-management/PipelineSummary'
import { FileList } from '@/components/data-management/FileList'
import { PipelineStatus } from '@/components/data-management/PipelineStatus'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DataManagementPage() {
  const { companyId } = useCompany()
  const { user } = useAuthStore()
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const handleImportSuccess = () => {
    // Refresh will be handled by components that auto-refresh
  }

  const handleFileSelect = (file: any) => {
    setSelectedFile(file.name)
  }

  if (!companyId) {
    return (
      <DashboardLayout>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Please select a company to manage data.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-white flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Management</h1>
            <p className="text-gray-600 mt-1">Manage data files and monitor pipeline processing</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </Button>
            <ImportDataDialog
              open={importDialogOpen}
              onOpenChange={setImportDialogOpen}
              objectName="Data File"
              companyId={companyId}
              userId={user?.id}
              onImportSuccess={handleImportSuccess}
            />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Pipeline Summary */}
            <PipelineSummary />

            {/* File List and Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <FileList onFileSelect={handleFileSelect} />
              </div>
              <div>
                <PipelineStatus fileName={selectedFile || undefined} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
