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
import { deleteClientAction } from '@/app/actions/clients'

interface DeleteClientDialogProps {
  clientId: string
  clientName: string
}

export default function DeleteClientDialog({ clientId, clientName }: DeleteClientDialogProps) {
  const router = useRouter()

  async function handleDelete() {
    try {
      await deleteClientAction(clientId)
      toast('Klient usunięty')
      router.refresh()
    } catch {
      toast.error('Błąd usuwania klienta')
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
        title="Usuń klienta"
      >
        <Trash2 size={14} />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Usuń klienta</AlertDialogTitle>
          <AlertDialogDescription>
            Czy na pewno chcesz usunąć klienta &quot;{clientName}&quot;? Tej operacji nie można cofnąć.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anuluj</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
            Usuń
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
