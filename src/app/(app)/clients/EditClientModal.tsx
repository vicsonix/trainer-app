'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { updateClientAction } from '@/app/actions/clients'
import type { PackageOption } from './page'
import ClientForm from './ClientForm'

interface EditClientModalProps {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  package_id: string | null
  interview_notes: string | null
  plan_url: string | null
  packages: PackageOption[]
}

export default function EditClientModal({
  id,
  first_name,
  last_name,
  phone,
  email,
  package_id,
  interview_notes,
  plan_url,
  packages,
}: EditClientModalProps) {
  const [open, setOpen] = useState(false)
  const boundUpdate = updateClientAction.bind(null, id)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        title="Edytuj klienta"
      >
        <Pencil size={14} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj klienta</DialogTitle>
          </DialogHeader>
          <ClientForm
            action={boundUpdate}
            defaultValues={{
              first_name,
              last_name,
              phone: phone ?? '',
              email: email ?? '',
              package_id: package_id ?? '',
              interview_notes: interview_notes ?? '',
              plan_url: plan_url ?? '',
            }}
            packages={packages}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
