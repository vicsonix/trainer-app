'use client'

import { useState, useEffect, useActionState, useMemo } from 'react'
import type { ModalClient } from './types'
import { createAppointmentAction } from '@/app/actions/appointments'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  prefillDate: Date | null
  clients: ModalClient[]
}

function toDateStr(date: Date | null): string {
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toTimeStr(date: Date | null): string {
  if (!date) return ''
  const h = date.getHours()
  const min = date.getMinutes()
  if (h === 0 && min === 0) return '' // month-view click — no time component
  const rounded = min < 30 ? 0 : 30
  return `${String(h).padStart(2, '0')}:${String(rounded).padStart(2, '0')}`
}

type FormProps = {
  initialDate: string
  initialTime: string
  clients: ModalClient[]
  tz: string
  onSuccess: () => void
}

// Extracted so it mounts fresh on every open (via key in parent), avoiding
// the need to sync state from props in effects.
function CreateForm({ initialDate, initialTime, clients, tz, onSuccess }: FormProps) {
  const [state, action, pending] = useActionState(createAppointmentAction, null)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [dateValue, setDateValue]   = useState(initialDate)
  const [timeValue, setTimeValue]   = useState(initialTime)

  const selectedClient = clients.find(c => c.id === selectedClientId) ?? null
  const errors = state && 'errors' in state ? state.errors : {}

  // Calling parent callback — not setting own state, allowed in effects
  useEffect(() => {
    if (state && 'success' in state) onSuccess()
  }, [state, onSuccess])

  const sortedClients = clients
    .slice()
    .sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    )

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="tz" value={tz} />

      {/* Client */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="create_client">Klient *</Label>
        <Select
          name="client_id"
          value={selectedClientId}
          onValueChange={setSelectedClientId}
        >
          <SelectTrigger
            id="create_client"
            className="w-full"
            aria-invalid={!!errors.client_id}
          >
            <SelectValue placeholder="Wybierz klienta…" />
          </SelectTrigger>
          <SelectContent>
            {sortedClients.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.client_id && (
          <p className="text-xs text-destructive">{errors.client_id[0]}</p>
        )}
      </div>

      {/* Package info / one-off price (shown once client is selected) */}
      {selectedClient?.packageId ? (
        <>
          <input type="hidden" name="package_id" value={selectedClient.packageId} />
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {selectedClient.packagePrice !== null && selectedClient.packageVisitCount
              ? `${(selectedClient.packagePrice / selectedClient.packageVisitCount).toFixed(2)} zł za wizytę`
              : 'Z pakietu'}
            {' '}
            <span className="font-medium text-foreground">
              (z pakietu {selectedClient.packageName})
            </span>
          </p>
        </>
      ) : selectedClient ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="create_price">Cena wizyty (zł)</Label>
          <Input
            id="create_price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            placeholder="Opcjonalne"
          />
          {errors.price && <p className="text-xs text-destructive">{errors.price[0]}</p>}
        </div>
      ) : null}

      {/* Date */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="create_date">Data *</Label>
        <Input
          id="create_date"
          name="date"
          type="date"
          value={dateValue}
          onChange={e => setDateValue(e.target.value)}
          aria-invalid={!!errors.date}
        />
        {errors.date && <p className="text-xs text-destructive">{errors.date[0]}</p>}
      </div>

      {/* Start time */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="create_time">Godzina *</Label>
        <Input
          id="create_time"
          name="start_time"
          type="time"
          value={timeValue}
          onChange={e => setTimeValue(e.target.value)}
          aria-invalid={!!errors.start_time}
        />
        {errors.start_time && (
          <p className="text-xs text-destructive">{errors.start_time[0]}</p>
        )}
      </div>

      {/* Duration */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="create_duration">Czas trwania *</Label>
        <Select name="duration" defaultValue="60">
          <SelectTrigger
            id="create_duration"
            className="w-full"
            aria-invalid={!!errors.duration}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 minut</SelectItem>
            <SelectItem value="60">60 minut</SelectItem>
            <SelectItem value="90">90 minut</SelectItem>
            <SelectItem value="120">120 minut</SelectItem>
          </SelectContent>
        </Select>
        {errors.duration && (
          <p className="text-xs text-destructive">{errors.duration[0]}</p>
        )}
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="create_notes">Notatki</Label>
        <Textarea id="create_notes" name="notes" placeholder="Opcjonalne" rows={3} />
      </div>

      {errors._form && (
        <p className="text-sm text-destructive">{errors._form[0]}</p>
      )}

      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? 'Zapisywanie…' : 'Zapisz wizytę'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export default function CreateAppointmentModal({ open, onOpenChange, prefillDate, clients }: Props) {
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nowa wizyta</DialogTitle>
        </DialogHeader>

        {/* Mount a fresh form on every open so state initializes from prefillDate.
            Key changes whenever the dialog opens with a new date. */}
        {open && (
          <CreateForm
            key={prefillDate?.getTime() ?? 0}
            initialDate={toDateStr(prefillDate)}
            initialTime={toTimeStr(prefillDate)}
            clients={clients}
            tz={tz}
            onSuccess={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
