'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createClientAction } from '@/app/actions/clients'
import type { PackageOption } from './page'
import ClientForm from './ClientForm'

interface ClientFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  packages: PackageOption[]
}

export default function ClientFormModal({ open, onOpenChange, packages }: ClientFormModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nowy klient</DialogTitle>
        </DialogHeader>
        <ClientForm
          action={createClientAction}
          packages={packages}
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
