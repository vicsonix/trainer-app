'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createPackageAction } from '@/app/actions/packages'
import PackageForm from './PackageForm'

interface PackageFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultVisits?: number
}

export default function PackageFormModal({
  open,
  onOpenChange,
  defaultVisits,
}: PackageFormModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nowy pakiet</DialogTitle>
        </DialogHeader>
        <PackageForm
          action={createPackageAction}
          defaultVisits={defaultVisits}
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
