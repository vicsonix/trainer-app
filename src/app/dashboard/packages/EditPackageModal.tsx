'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { updatePackageAction } from '@/app/actions/packages'
import PackageForm from './PackageForm'

interface EditPackageModalProps {
  id: string
  name: string
  visitCount: number
  price: number
}

export default function EditPackageModal({
  id,
  name,
  visitCount,
  price,
}: EditPackageModalProps) {
  const [open, setOpen] = useState(false)
  const boundUpdate = updatePackageAction.bind(null, id)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Edytuj pakiet"
      >
        <Pencil size={14} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj pakiet</DialogTitle>
          </DialogHeader>
          <PackageForm
            action={boundUpdate}
            defaultValues={{ name, visit_count: visitCount, price }}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
