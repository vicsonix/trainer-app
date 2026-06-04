import { createClient } from '@/lib/supabase/server'
import type { AppointmentStatus, CalendarEvent, ModalClient } from './types'
import CalendarClientSection from './CalendarClientSection'

type ApptRow = {
  id: string
  client_id: string
  package_id: string | null
  starts_at: string
  ends_at: string
  notes: string | null
  price: number | null
  status: string
  clients: {
    id: string
    first_name: string
    last_name: string
    phone: string | null
    email: string | null
    interview_notes: string | null
    plan_url: string | null
    packages: { id: string; name: string; visit_count: number; price: number } | null
  } | null
}

type ClientRow = {
  id: string
  first_name: string
  last_name: string
  package_id: string | null
  packages: { id: string; name: string; price: number; visit_count: number } | null
}

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: apptData }, { data: clientData }] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, client_id, package_id, starts_at, ends_at, notes, price, status, clients(id, first_name, last_name, phone, email, interview_notes, plan_url, packages(id, name, visit_count, price))')
      .eq('trainer_id', user!.id)
      .order('starts_at'),
    supabase
      .from('clients')
      .select('id, first_name, last_name, package_id, packages(id, name, price, visit_count)')
      .eq('trainer_id', user!.id)
      .order('first_name'),
  ])

  const appointments = (apptData ?? []) as unknown as ApptRow[]
  const clientRows  = (clientData ?? []) as unknown as ClientRow[]

  // Completed appointments consume a package slot; cancelled/rescheduled ones do not
  const completedCountByPackageId: Record<string, number> = {}
  const scheduledCountByPackageId: Record<string, number> = {}
  for (const appt of appointments) {
    if (!appt.package_id) continue
    if (appt.status === 'completed') {
      completedCountByPackageId[appt.package_id] = (completedCountByPackageId[appt.package_id] ?? 0) + 1
    } else if (appt.status === 'scheduled') {
      scheduledCountByPackageId[appt.package_id] = (scheduledCountByPackageId[appt.package_id] ?? 0) + 1
    }
  }

  const events: CalendarEvent[] = appointments.map(appt => {
    const client = appt.clients
    const pkg    = client?.packages ?? null
    const scheduledSessions =
      pkg && appt.package_id
        ? (scheduledCountByPackageId[appt.package_id] ?? 0)
        : null
    const remainingSessions =
      pkg && appt.package_id
        ? pkg.visit_count - (completedCountByPackageId[appt.package_id] ?? 0) - (scheduledCountByPackageId[appt.package_id] ?? 0)
        : null

    return {
      id:                appt.id,
      clientId:          appt.client_id,
      clientName:        client ? `${client.first_name} ${client.last_name}` : 'Nieznany klient',
      startsAt:          new Date(appt.starts_at),
      endsAt:            new Date(appt.ends_at),
      notes:             appt.notes,
      scheduledSessions,
      remainingSessions,
      packageName:       pkg?.name ?? null,
      packageId:         appt.package_id,
      price:             appt.price,
      status:            (appt.status ?? 'scheduled') as AppointmentStatus,
      client: {
        id:             client?.id ?? '',
        firstName:      client?.first_name ?? '',
        lastName:       client?.last_name ?? '',
        phone:          client?.phone ?? null,
        email:          client?.email ?? null,
        interviewNotes: client?.interview_notes ?? null,
        planUrl:        client?.plan_url ?? null,
      },
    }
  })

  const modalClients: ModalClient[] = clientRows.map(c => ({
    id:               c.id,
    firstName:        c.first_name,
    lastName:         c.last_name,
    packageId:        c.package_id,
    packageName:      c.packages?.name ?? null,
    packagePrice:     c.packages?.price ?? null,
    packageVisitCount: c.packages?.visit_count ?? null,
  }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-3 sm:py-8">
      <div className="mb-3 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-lobster-pink-600 to-lobster-pink-400 bg-clip-text text-transparent">
          Kalendarz
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Twoje wizyty i sesje treningowe
        </p>
      </div>

      <CalendarClientSection events={events} clients={modalClients} />
    </div>
  )
}
