'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Company, CompanyUser } from '@/types/company-schema'
import { EnterpriseGroupService } from '@/lib/services/enterprise-group-service'
import {
  ArrowRightLeft,
  Building2,
  Loader2,
  UserCircle,
  ArrowRight,
  Copy,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface TransferUserDialogProps {
  open: boolean
  onClose: () => void
  user: CompanyUser
  fromCompany: Company
  companies: Company[]
  groupId: string
  onTransferComplete: () => void
}

export function TransferUserDialog({
  open,
  onClose,
  user,
  fromCompany,
  companies,
  groupId,
  onTransferComplete,
}: TransferUserDialogProps) {
  const [targetCompanyId, setTargetCompanyId] = useState('')
  const [mode, setMode] = useState<'transfer' | 'copy'>('transfer')
  const [role, setRole] = useState(user.role || 'employee')
  const [processing, setProcessing] = useState(false)

  const targetCompany = companies.find(c => c.id === targetCompanyId)

  const handleSubmit = async () => {
    if (!targetCompanyId) {
      toast.error('Please select a target company')
      return
    }

    try {
      setProcessing(true)

      if (mode === 'transfer') {
        await EnterpriseGroupService.transferUser(
          groupId,
          user.id,
          fromCompany.id,
          targetCompanyId,
          role
        )
        toast.success(`${user.name || user.email} transferred to ${targetCompany?.name}`)
      } else {
        await EnterpriseGroupService.addUserToCompany(
          groupId,
          user.id,
          fromCompany.id,
          targetCompanyId,
          role
        )
        toast.success(`${user.name || user.email} added to ${targetCompany?.name}`)
      }

      onTransferComplete()
    } catch (err: any) {
      console.error('Transfer failed:', err)
      toast.error(err.message || 'Transfer failed')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Move User Between Companies
          </DialogTitle>
          <DialogDescription>
            Transfer or copy a user to another company in the enterprise group.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* User Info */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
            <UserCircle className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">{user.name || user.displayName || 'Unknown'}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          {/* Mode Selection */}
          <div>
            <Label className="text-foreground mb-2 block">Action</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('transfer')}
                className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                  mode === 'transfer'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent/50'
                }`}
              >
                <ArrowRightLeft className="h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Transfer</p>
                  <p className="text-xs opacity-70">Remove from source</p>
                </div>
              </button>
              <button
                onClick={() => setMode('copy')}
                className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                  mode === 'copy'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent/50'
                }`}
              >
                <Copy className="h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Add to Company</p>
                  <p className="text-xs opacity-70">Keep in both</p>
                </div>
              </button>
            </div>
          </div>

          {/* Visual Transfer */}
          <div className="flex items-center gap-3">
            <div className="flex-1 p-3 rounded-lg border bg-muted/30 text-center">
              <Building2 className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs font-medium text-foreground truncate">{fromCompany.name}</p>
              <p className="text-[10px] text-muted-foreground">Source</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 p-3 rounded-lg border border-primary/30 bg-primary/5 text-center">
              <Building2 className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-xs font-medium text-foreground truncate">
                {targetCompany?.name || 'Select target...'}
              </p>
              <p className="text-[10px] text-muted-foreground">Target</p>
            </div>
          </div>

          {/* Target Company */}
          <div>
            <Label className="text-foreground mb-2 block">Target Company</Label>
            <select
              value={targetCompanyId}
              onChange={e => setTargetCompanyId(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary/20 outline-none"
            >
              <option value="">Select a company...</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.id}</option>
              ))}
            </select>
          </div>

          {/* Role in Target */}
          <div>
            <Label className="text-foreground mb-2 block">Role in Target Company</Label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as CompanyUser['role'])}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary/20 outline-none"
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!targetCompanyId || processing}
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {mode === 'transfer' ? (
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {mode === 'transfer' ? 'Transfer User' : 'Add to Company'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
