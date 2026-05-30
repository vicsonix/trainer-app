'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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
      <AlertDialogTrigger className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 transition-colors">
        Usuń
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
