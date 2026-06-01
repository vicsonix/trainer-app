'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ClientFormState } from '@/app/actions/clients'
import type { PackageOption } from './page'
import PackageFormModal from '@/app/(app)/packages/PackageFormModal'

interface ClientFormProps {
  action: (prevState: ClientFormState, formData: FormData) => Promise<ClientFormState>
  defaultValues?: {
    first_name: string
    last_name: string
    phone: string
    email: string
    package_id: string
    interview_notes: string
    plan_url: string
  }
  packages: PackageOption[]
  onSuccess?: () => void
}

export default function ClientForm({ action, defaultValues, packages, onSuccess }: ClientFormProps) {
  const router = useRouter()
  const onSuccessRef = useRef(onSuccess)
  const routerRef = useRef(router)
  useEffect(() => { onSuccessRef.current = onSuccess; routerRef.current = router })
  const [state, formAction, pending] = useActionState(action, null)

  const [firstName, setFirstName] = useState(defaultValues?.first_name ?? '')
  const [lastName, setLastName] = useState(defaultValues?.last_name ?? '')
  const [phone, setPhone] = useState(defaultValues?.phone ?? '')
  const [email, setEmail] = useState(defaultValues?.email ?? '')
  const [packageId, setPackageId] = useState(defaultValues?.package_id || 'none')
  const [interviewNotes, setInterviewNotes] = useState(defaultValues?.interview_notes ?? '')
  const [planUrl, setPlanUrl] = useState(defaultValues?.plan_url ?? '')
  const [packageModalOpen, setPackageModalOpen] = useState(false)

  useEffect(() => {
    if (state && 'success' in state && state.success) {
      toast('Klient zapisany')
      routerRef.current.refresh()
      if (onSuccessRef.current) {
        onSuccessRef.current()
      } else {
        routerRef.current.push('/clients')
      }
    }
  }, [state])

  return (
    <>
      <form action={formAction} className="flex flex-col gap-4">
        {/* First name + Last name */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="first_name">Imię</Label>
            <Input
              id="first_name"
              name="first_name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="np. Anna"
            />
            {state && 'errors' in state && state.errors.first_name?.[0] && (
              <p className="text-sm text-red-600">{state.errors.first_name[0]}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="last_name">Nazwisko</Label>
            <Input
              id="last_name"
              name="last_name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="np. Kowalska"
            />
            {state && 'errors' in state && state.errors.last_name?.[0] && (
              <p className="text-sm text-red-600">{state.errors.last_name[0]}</p>
            )}
          </div>
        </div>

        {/* Phone + Email */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="np. +48 500 000 000"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="np. anna@example.com"
            />
            {state && 'errors' in state && state.errors.email?.[0] && (
              <p className="text-sm text-red-600">{state.errors.email[0]}</p>
            )}
          </div>
        </div>

        {/* Package */}
        <div className="flex flex-col gap-1">
          <Label>Pakiet</Label>
          <input type="hidden" name="package_id" value={packageId === 'none' ? '' : packageId} />
          <Select value={packageId} onValueChange={setPackageId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Wybierz pakiet (opcjonalnie)" />
            </SelectTrigger>
            <SelectContent className="[--accent:var(--color-lobster-pink-50)] [--accent-foreground:var(--color-lobster-pink-700)] dark:[--accent:var(--color-lobster-pink-950)] dark:[--accent-foreground:var(--color-lobster-pink-300)]">
              <SelectItem value="none">Brak pakietu</SelectItem>
              {packages.map((pkg) => (
                <SelectItem key={pkg.id} value={pkg.id}>
                  {pkg.name} · {pkg.visit_count} wizyt
                </SelectItem>
              ))}
              <div className="border-t my-1 border-soft-linen-200 dark:border-carbon-black-700" />
              <button
                type="button"
                className="flex w-full items-center gap-1.5 px-2 py-1.5 text-sm text-lobster-pink-700 dark:text-lobster-pink-300 hover:bg-lobster-pink-50 dark:hover:bg-lobster-pink-900/20 cursor-pointer"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setPackageModalOpen(true)
                }}
              >
                <Plus size={12} />
                Dodaj pakiet
              </button>
            </SelectContent>
          </Select>
          {packages.length === 0 && packageId === 'none' && (
            <p className="text-xs text-muted-foreground">
              Brak pakietów — kliknij &apos;Dodaj pakiet&apos;, żeby przypisać jeden.
            </p>
          )}
          {state && 'errors' in state && state.errors.package_id?.[0] && (
            <p className="text-sm text-red-600">{state.errors.package_id[0]}</p>
          )}
        </div>

        {/* Interview notes */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="interview_notes">Notatki z wywiadu</Label>
          <Textarea
            id="interview_notes"
            name="interview_notes"
            value={interviewNotes}
            onChange={(e) => setInterviewNotes(e.target.value)}
            rows={4}
            className="resize-y"
            placeholder="Cele, ograniczenia, historia zdrowotna…"
          />
        </div>

        {/* Plan URL */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="plan_url">Link do planu treningowego</Label>
          <Input
            id="plan_url"
            name="plan_url"
            type="text"
            inputMode="url"
            value={planUrl}
            onChange={(e) => setPlanUrl(e.target.value)}
            placeholder="https://…"
          />
          {state && 'errors' in state && state.errors.plan_url?.[0] && (
            <p className="text-sm text-red-600">{state.errors.plan_url[0]}</p>
          )}
        </div>

        {state && 'errors' in state && state.errors._form?.[0] && (
          <p className="text-sm text-red-600">{state.errors._form[0]}</p>
        )}

        <Button type="submit" disabled={pending} className="mt-2">
          {pending ? 'Zapisywanie…' : 'Zapisz'}
        </Button>
      </form>

      <PackageFormModal open={packageModalOpen} onOpenChange={setPackageModalOpen} />
    </>
  )
}
