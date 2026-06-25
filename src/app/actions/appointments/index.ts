'use server'

import { revalidatePath } from 'next/cache'
import { parseDateTime, toZoned } from '@internationalized/date'
import type { ZodIssue } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { appointmentSchema } from './schema'

function issuesByField(issues: ZodIssue[]) {
  const out: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = issue.path[0]
    if (typeof key === 'string') (out[key] ??= []).push(issue.message)
  }
  return out
}

export type AppointmentFormState =
  | { errors: {
      client_id?: string[]
      package_id?: string[]
      date?: string[]
      start_time?: string[]
      duration?: string[]
      notes?: string[]
      price?: string[]
      _form?: string[]
    }}
  | { success: true }
  | null

function parseFormData(formData: FormData) {
  return appointmentSchema.safeParse({
    client_id:  formData.get('client_id'),
    package_id: formData.get('package_id'),
    date:       formData.get('date'),
    start_time: formData.get('start_time'),
    duration:   formData.get('duration'),
    notes:      formData.get('notes'),
    price:      formData.get('price'),
    tz:         formData.get('tz'),
  })
}

function computeTimes(date: string, start_time: string, tz: string, duration: string) {
  const localDt = parseDateTime(`${date}T${start_time}`)
  const zonedDt = toZoned(localDt, tz)
  const startsAt = zonedDt.toDate()
  const endsAt = new Date(startsAt.getTime() + Number(duration) * 60_000)
  return { startsAt, endsAt }
}

export async function createAppointmentAction(
  _prevState: AppointmentFormState,
  formData: FormData
): Promise<AppointmentFormState> {
  const result = parseFormData(formData)

  if (!result.success) {
    return { errors: issuesByField(result.error.issues) }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { errors: { _form: ['Sesja wygasła'] } }

  const { startsAt, endsAt } = computeTimes(
    result.data.date,
    result.data.start_time,
    result.data.tz,
    result.data.duration,
  )

  const { count: overlapCount } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('trainer_id', user.id)
    .lt('starts_at', endsAt.toISOString())
    .gt('ends_at', startsAt.toISOString())
    .neq('status', 'cancelled')
    .neq('status', 'no_show')

  if (overlapCount && overlapCount > 0) {
    return { errors: { _form: ['Masz już wizytę w tym przedziale czasowym'] } }
  }

  const { error } = await supabase.from('appointments').insert({
    trainer_id: user.id,
    client_id:  result.data.client_id,
    package_id: result.data.package_id,
    starts_at:  startsAt.toISOString(),
    ends_at:    endsAt.toISOString(),
    notes:      result.data.notes || null,
    price:      result.data.price,
  })

  if (error) {
    return { errors: { _form: ['Nie udało się zapisać wizyty'] } }
  }

  revalidatePath('/calendar')
  return { success: true }
}

export async function updateAppointmentAction(
  id: string,
  _prevState: AppointmentFormState,
  formData: FormData
): Promise<AppointmentFormState> {
  const result = parseFormData(formData)

  if (!result.success) {
    return { errors: issuesByField(result.error.issues) }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { errors: { _form: ['Sesja wygasła'] } }

  const { startsAt, endsAt } = computeTimes(
    result.data.date,
    result.data.start_time,
    result.data.tz,
    result.data.duration,
  )

  const { count: overlapCount } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('trainer_id', user.id)
    .neq('id', id)
    .lt('starts_at', endsAt.toISOString())
    .gt('ends_at', startsAt.toISOString())
    .neq('status', 'cancelled')
    .neq('status', 'no_show')

  if (overlapCount && overlapCount > 0) {
    return { errors: { _form: ['Masz już wizytę w tym przedziale czasowym'] } }
  }

  const { error } = await supabase
    .from('appointments')
    .update({
      client_id:  result.data.client_id,
      package_id: result.data.package_id,
      starts_at:  startsAt.toISOString(),
      ends_at:    endsAt.toISOString(),
      notes:      result.data.notes || null,
      price:      result.data.price,
    })
    .eq('id', id)
    .eq('trainer_id', user.id)

  if (error) {
    return { errors: { _form: ['Nie udało się zaktualizować wizyty'] } }
  }

  revalidatePath('/calendar')
  return { success: true }
}

export async function deleteAppointmentAction(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Sesja wygasła' }

  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id)
    .eq('trainer_id', user.id)

  if (error) return { error: 'Nie udało się usunąć wizyty' }

  revalidatePath('/calendar')
  return {}
}

export async function updateAppointmentStatusAction(
  id: string,
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Sesja wygasła' }

  if (status === 'completed' || status === 'no_show') {
    const { data: appt } = await supabase
      .from('appointments')
      .select('starts_at')
      .eq('id', id)
      .eq('trainer_id', user.id)
      .single()
    if (!appt || new Date(appt.starts_at) > new Date()) {
      return { error: 'Nie można oznaczyć przyszłej wizyty jako odbytej' }
    }
  }

  const { error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .eq('trainer_id', user.id)

  if (error) return { error: 'Nie udało się zaktualizować statusu' }

  revalidatePath('/calendar')
  return {}
}
