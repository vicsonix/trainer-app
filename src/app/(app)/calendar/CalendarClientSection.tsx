'use client'

import { useState } from 'react'
import type { CalendarEvent, ModalClient } from './types'
import CalendarView from './CalendarView'
import CreateAppointmentModal from './CreateAppointmentModal'
import AppointmentDetailModal from './AppointmentDetailModal'

type Props = {
  events: CalendarEvent[]
  clients: ModalClient[]
}

export default function CalendarClientSection({ events, clients }: Props) {
  const [createModal, setCreateModal] = useState<{ open: boolean; prefillDate: Date | null }>({
    open: false,
    prefillDate: null,
  })
  const [detailModal, setDetailModal] = useState<{ open: boolean; event: CalendarEvent | null }>({
    open: false,
    event: null,
  })

  return (
    <>
      <CalendarView
        events={events}
        onSlotClick={date => setCreateModal({ open: true, prefillDate: date })}
        onEventClick={event => setDetailModal({ open: true, event })}
      />

      <CreateAppointmentModal
        open={createModal.open}
        onOpenChange={open => setCreateModal(prev => ({ ...prev, open }))}
        prefillDate={createModal.prefillDate}
        clients={clients}
      />

      <AppointmentDetailModal
        open={detailModal.open}
        onOpenChange={open => setDetailModal(prev => ({ ...prev, open }))}
        event={detailModal.event}
      />
    </>
  )
}
