'use client'

import { useState, useEffect, useActionState, useMemo, useTransition } from 'react'
import { ExternalLink } from 'lucide-react'
import type { CalendarEvent } from './types'
import { updateAppointmentAction, deleteAppointmentAction, updateAppointmentStatusAction } from '@/app/actions/appointments'
import type { AppointmentFormState } from '@/app/actions/appointments'
import type { AppointmentStatus } from './types'
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
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  event: CalendarEvent | null
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function toDateStr(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toTimeStr(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function getDurationValue(event: CalendarEvent): string {
  const mins = Math.round((event.endsAt.getTime() - event.startsAt.getTime()) / 60_000)
  return [30, 60, 90, 120].includes(mins) ? String(mins) : '60'
}

// Extracted so we can key it on event.id, giving each event fresh useActionState
type EditFormProps = {
  event: CalendarEvent
  tz: string
  onSuccess: () => void
  onBack: () => void
}

function EditForm({ event, tz, onSuccess, onBack }: EditFormProps) {
  const boundAction = useMemo(
    () => updateAppointmentAction.bind(null, event.id),
    [event.id]
  )
  const [state, action, pending] = useActionState(
    boundAction as (prev: AppointmentFormState, fd: FormData) => Promise<AppointmentFormState>,
    null
  )

  // Calling parent callback — not setting own state, allowed in effects
  useEffect(() => {
    if (state && 'success' in state) onSuccess()
  }, [state, onSuccess])

  const errors = state && 'errors' in state ? state.errors : {}

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="tz" value={tz} />
      <input type="hidden" name="client_id" value={event.clientId} />
      {event.packageId && (
        <input type="hidden" name="package_id" value={event.packageId} />
      )}

      {/* Date */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit_date">Data *</Label>
        <Input
          id="edit_date"
          name="date"
          type="date"
          defaultValue={toDateStr(event.startsAt)}
          aria-invalid={!!errors.date}
        />
        {errors.date && <p className="text-xs text-destructive">{errors.date[0]}</p>}
      </div>

      {/* Start time */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit_time">Godzina *</Label>
        <Input
          id="edit_time"
          name="start_time"
          type="time"
          defaultValue={toTimeStr(event.startsAt)}
          aria-invalid={!!errors.start_time}
        />
        {errors.start_time && (
          <p className="text-xs text-destructive">{errors.start_time[0]}</p>
        )}
      </div>

      {/* Duration */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit_duration">Czas trwania *</Label>
        <Select name="duration" defaultValue={getDurationValue(event)}>
          <SelectTrigger id="edit_duration" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 minut</SelectItem>
            <SelectItem value="60">60 minut</SelectItem>
            <SelectItem value="90">90 minut</SelectItem>
            <SelectItem value="120">120 minut</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit_notes">Notatki</Label>
        <Textarea
          id="edit_notes"
          name="notes"
          defaultValue={event.notes ?? ''}
          rows={3}
        />
      </div>

      {/* One-off price */}
      {!event.packageId && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit_price">Cena wizyty (zł)</Label>
          <Input
            id="edit_price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={event.price ?? ''}
          />
        </div>
      )}

      {errors._form && (
        <p className="text-sm text-destructive">{errors._form[0]}</p>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          disabled={pending}
        >
          Anuluj
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Zapisywanie…' : 'Zapisz zmiany'}
        </Button>
      </DialogFooter>
    </form>
  )
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled:  'Zaplanowana',
  completed:  'Odbyła się',
  cancelled:  'Anulowana',
  no_show:    'Nieobecność',
}

const STATUS_CLASSES: Record<AppointmentStatus, string> = {
  scheduled: 'bg-primary/10 text-primary',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-muted text-muted-foreground line-through',
  no_show:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_CLASSES[status])}>
      {STATUS_LABELS[status]}
    </span>
  )
}

type ContentProps = {
  event: CalendarEvent
  tz: string
  onClose: () => void
}

// Extracted so state initializes fresh via key={event.id} in parent — no reset
// effects needed when switching between events or closing/reopening.
function ModalContent({ event, tz, onClose }: ContentProps) {
  const [mode, setMode]                         = useState<'detail' | 'edit'>('detail')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError]           = useState<string | null>(null)
  const [deletePending, startDelete]            = useTransition()
  const [currentStatus, setCurrentStatus]       = useState<AppointmentStatus>(event.status)
  const [statusError, setStatusError]           = useState<string | null>(null)
  const [statusPending, startStatusUpdate]      = useTransition()

  function handleDelete() {
    setDeleteError(null)
    startDelete(async () => {
      const result = await deleteAppointmentAction(event.id)
      if (result.error) {
        setDeleteError(result.error)
      } else {
        onClose()
      }
    })
  }

  function handleStatusChange(status: AppointmentStatus) {
    setStatusError(null)
    startStatusUpdate(async () => {
      const result = await updateAppointmentStatusAction(event.id, status)
      if (result.error) {
        setStatusError(result.error)
      } else {
        setCurrentStatus(status)
      }
    })
  }

  const title = mode === 'detail' ? event.clientName : 'Edytuj wizytę'

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>

      {mode === 'edit' ? (
        <EditForm
          key={event.id}
          event={event}
          tz={tz}
          onSuccess={onClose}
          onBack={() => setMode('detail')}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {/* Client card */}
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
            {event.packageName && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Pakiet:</span>
                <span className="text-sm font-medium">{event.packageName}</span>
                <span className="ml-auto flex items-center gap-1">
                  {event.scheduledSessions !== null && (
                    <span className="rounded-full bg-jungle-teal-500 px-2 py-0.5 text-xs font-semibold text-white">
                      {event.scheduledSessions} zajęte
                    </span>
                  )}
                  {event.remainingSessions !== null && (
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold text-white',
                      event.remainingSessions <= 2 ? 'bg-destructive' : 'bg-primary'
                    )}>
                      {event.remainingSessions} dostępne
                    </span>
                  )}
                </span>
              </div>
            )}

            {event.client.interviewNotes && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Notatki wywiadowcze
                </p>
                <p className="max-h-28 overflow-y-auto text-sm leading-relaxed">
                  {event.client.interviewNotes}
                </p>
              </div>
            )}

            {event.client.planUrl && (
              <a
                href={event.client.planUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink size={14} />
                Otwórz plan treningowy
              </a>
            )}
          </div>

          {/* Appointment time */}
          <div className="space-y-1 text-sm">
            <p className="capitalize text-muted-foreground">{formatDate(event.startsAt)}</p>
            <p className="font-medium">
              {formatTime(event.startsAt)} – {formatTime(event.endsAt)}
            </p>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
              <StatusBadge status={currentStatus} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['completed', 'cancelled', 'no_show', 'scheduled'] as const)
                .filter(s => s !== currentStatus)
                .map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    disabled={statusPending}
                    className="rounded-full border border-border px-2.5 py-0.5 text-xs transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
            </div>
            {statusError && <p className="text-xs text-destructive">{statusError}</p>}
          </div>

          {event.notes && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Notatki do wizyty
              </p>
              <p className="text-sm">{event.notes}</p>
            </div>
          )}

          {/* Inline delete confirm */}
          {showDeleteConfirm && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-3">
              <p className="text-sm font-medium text-destructive">
                Czy na pewno usunąć wizytę?
              </p>
              {deleteError && (
                <p className="text-xs text-destructive">{deleteError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deletePending}
                >
                  Anuluj
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deletePending}
                >
                  {deletePending ? 'Usuwanie…' : 'Usuń'}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={showDeleteConfirm}
            >
              Usuń
            </Button>
            <Button size="sm" onClick={() => setMode('edit')}>
              Edytuj
            </Button>
          </DialogFooter>
        </div>
      )}
    </>
  )
}

export default function AppointmentDetailModal({ open, onOpenChange, event }: Props) {
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mount fresh content for each event; unmount on close so state resets */}
        {open && event && (
          <ModalContent
            key={event.id}
            event={event}
            tz={tz}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
