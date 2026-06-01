'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PackageFormState } from '@/app/actions/packages'

const CHIPS = [5, 10, 20]

interface PackageFormProps {
  action: (prevState: PackageFormState, formData: FormData) => Promise<PackageFormState>
  defaultValues?: { name: string; visit_count: number; price: number }
  defaultVisits?: number
  onSuccess?: () => void
}

export default function PackageForm({
  action,
  defaultValues,
  defaultVisits,
  onSuccess,
}: PackageFormProps) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(action, null)

  const initialVisits = defaultVisits ?? defaultValues?.visit_count ?? 10
  const [name, setName] = useState(defaultValues?.name ?? '')
  const [visitCount, setVisitCount] = useState(initialVisits)
  const [price, setPrice] = useState(
    defaultValues?.price !== undefined ? String(defaultValues.price) : ''
  )

  const perSession =
    price && visitCount > 0
      ? (parseFloat(price) / visitCount).toFixed(2)
      : null

  useEffect(() => {
    if (state && 'success' in state && state.success) {
      toast('Pakiet zapisany')
      router.refresh()
      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/packages')
      }
    }
  }, [state, onSuccess, router])

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* Name */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="name">Nazwa</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="np. Pakiet 10 wizyt"
        />
        {state && 'errors' in state && state.errors.name?.[0] && (
          <p className="text-sm text-red-600">{state.errors.name[0]}</p>
        )}
      </div>

      {/* Visit count chips */}
      <div className="flex flex-col gap-1">
        <Label>Liczba wizyt</Label>
        <div className="flex gap-2">
          {CHIPS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setVisitCount(n)}
              className={cn(
                'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                visitCount === n
                  ? 'border-lobster-pink-600 bg-lobster-pink-50 text-lobster-pink-700 dark:bg-lobster-pink-950 dark:text-lobster-pink-300'
                  : 'border-soft-linen-300 hover:bg-soft-linen-100 dark:border-carbon-black-700 dark:hover:bg-carbon-black-800'
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <Input
          type="number"
          name="visit_count"
          value={visitCount}
          onChange={(e) => setVisitCount(Number(e.target.value))}
          min={1}
          className="mt-1"
        />
        {state && 'errors' in state && state.errors.visit_count?.[0] && (
          <p className="text-sm text-red-600">{state.errors.visit_count[0]}</p>
        )}
      </div>

      {/* Price */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="price">Cena</Label>
        <div className="flex items-center gap-2">
          <Input
            id="price"
            name="price"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground">PLN</span>
        </div>
        {perSession && (
          <p className="text-xs text-muted-foreground">= {perSession} PLN / sesja</p>
        )}
        {state && 'errors' in state && state.errors.price?.[0] && (
          <p className="text-sm text-red-600">{state.errors.price[0]}</p>
        )}
      </div>

      {state && 'errors' in state && state.errors._form?.[0] && (
        <p className="text-sm text-red-600">{state.errors._form[0]}</p>
      )}

      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? 'Zapisywanie…' : 'Zapisz'}
      </Button>
    </form>
  )
}
