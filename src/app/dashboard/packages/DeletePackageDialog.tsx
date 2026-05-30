'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { deletePackageAction } from '@/app/actions/packages'

interface DeletePackageDialogProps {
  packageId: string
  packageName: string
  clientCount: number
}

export default function DeletePackageDialog({
  packageId,
  packageName,
  clientCount,
}: DeletePackageDialogProps) {
  const router = useRouter()

  async function handleDelete() {
    try {
      await deletePackageAction(packageId)
      toast('Pakiet usunięty')
      router.refresh()
    } catch {
      toast.error('Błąd usuwania pakietu')
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Usuń pakiet">
        <Trash2 size={14} />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Usuń pakiet</AlertDialogTitle>
          <AlertDialogDescription>
            {clientCount > 0
              ? `Ten pakiet jest przypisany do ${clientCount} klienta/ów. Usunięcie go usunie przypisanie pakietu.`
              : `Czy na pewno chcesz usunąć pakiet "${packageName}"?`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anuluj</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            onClick={handleDelete}
          >
            Usuń
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
