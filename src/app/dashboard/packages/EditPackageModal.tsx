'use client'

import { useState } from 'react'
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
        className="rounded-md border border-soft-linen-300 px-3 py-1.5 text-sm font-medium hover:bg-soft-linen-100 dark:border-carbon-black-700 dark:hover:bg-carbon-black-800 transition-colors"
      >
        Edytuj
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
