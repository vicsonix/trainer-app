export type CalendarView = 'month' | 'week' | 'day'

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export type CalendarEvent = {
  id: string
  clientId: string
  clientName: string
  startsAt: Date
  endsAt: Date
  notes: string | null
  // Package visit: remainingSessions and packageName are set; price is the per-session rate derived from the package
  // One-off session: remainingSessions and packageName are null; price is the explicit appointment charge
  remainingSessions: number | null
  packageName: string | null
  packageId: string | null
  price: number | null
  status: AppointmentStatus
  client: {
    id: string
    firstName: string
    lastName: string
    phone: string | null
    email: string | null
    interviewNotes: string | null
    planUrl: string | null
  }
}

// Extended client shape used in the create/edit modal to drive the package_id + price display logic
export type ModalClient = {
  id: string
  firstName: string
  lastName: string
  packageId: string | null
  packageName: string | null
  packagePrice: number | null
  packageVisitCount: number | null
}
