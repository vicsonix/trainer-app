import { tool } from 'ai'
import { z } from 'zod'
import { parseDateTime, toZoned } from '@internationalized/date'
import type { SupabaseClient } from '@supabase/supabase-js'

function computeTimes(date: string, startTime: string, tz: string, duration: string) {
  const localDt = parseDateTime(`${date}T${startTime}`)
  const zonedDt = toZoned(localDt, tz)
  const startsAt = zonedDt.toDate()
  const endsAt = new Date(startsAt.getTime() + Number(duration) * 60_000)
  return { startsAt, endsAt }
}

const appointmentWriteSchema = z.object({
  client_id:  z.string().uuid().describe('Client UUID'),
  date:       z.string().describe('YYYY-MM-DD'),
  start_time: z.string().describe('HH:MM'),
  duration:   z.enum(['30', '60', '90', '120']).describe('Duration in minutes'),
  tz:         z.string().describe('IANA timezone, e.g. Europe/Warsaw'),
  package_id: z.string().uuid().optional().describe('Package UUID (optional)'),
  notes:      z.string().optional(),
  price:      z.number().optional().describe('Price in PLN'),
})

export function makeAppointmentTools(supabase: SupabaseClient, userId: string) {
  return {
    create_appointment: tool({
      description: 'Book a new training appointment for a client. Requires confirmation before executing.',
      inputSchema: appointmentWriteSchema,
      needsApproval: true,
      execute: async ({ client_id, date, start_time, duration, tz, package_id, notes, price }) => {
        try {
          const { startsAt, endsAt } = computeTimes(date, start_time, tz, duration)

          const { count: overlapCount } = await supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('trainer_id', userId)
            .lt('starts_at', endsAt.toISOString())
            .gt('ends_at', startsAt.toISOString())

          if (overlapCount && overlapCount > 0) {
            return { success: false, error: 'Overlap detected: you already have an appointment in that time slot.' }
          }

          const { error } = await supabase.from('appointments').insert({
            trainer_id: userId,
            client_id,
            package_id: package_id ?? null,
            starts_at:  startsAt.toISOString(),
            ends_at:    endsAt.toISOString(),
            notes:      notes || null,
            price:      price ?? null,
          })

          if (error) return { success: false, error: error.message }
          return { success: true, action: 'created', entity: 'appointment', name: `${date} o ${start_time}`, href: '/calendar' }
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),

    update_appointment: tool({
      description: 'Reschedule or update an existing appointment. Requires confirmation.',
      inputSchema: appointmentWriteSchema.extend({
        appointment_id: z.string().uuid().describe('Appointment UUID to update'),
      }),
      needsApproval: true,
      execute: async ({ appointment_id, client_id, date, start_time, duration, tz, package_id, notes, price }) => {
        try {
          const { startsAt, endsAt } = computeTimes(date, start_time, tz, duration)

          const { count: overlapCount } = await supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('trainer_id', userId)
            .neq('id', appointment_id)
            .lt('starts_at', endsAt.toISOString())
            .gt('ends_at', startsAt.toISOString())

          if (overlapCount && overlapCount > 0) {
            return { success: false, error: 'Overlap detected: you already have an appointment in that time slot.' }
          }

          const { error } = await supabase
            .from('appointments')
            .update({
              client_id,
              package_id: package_id ?? null,
              starts_at:  startsAt.toISOString(),
              ends_at:    endsAt.toISOString(),
              notes:      notes || null,
              price:      price ?? null,
            })
            .eq('id', appointment_id)
            .eq('trainer_id', userId)

          if (error) return { success: false, error: error.message }
          return { success: true, action: 'updated', entity: 'appointment', name: `${date} o ${start_time}`, href: '/calendar' }
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),

    delete_appointment: tool({
      description: 'Delete an appointment permanently. Requires confirmation.',
      inputSchema: z.object({
        appointment_id: z.string().uuid(),
      }),
      needsApproval: true,
      execute: async ({ appointment_id }) => {
        try {
          const { error } = await supabase
            .from('appointments')
            .delete()
            .eq('id', appointment_id)
            .eq('trainer_id', userId)

          if (error) return { success: false, error: error.message }
          return { success: true, action: 'deleted', entity: 'appointment' }
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),

    update_appointment_status: tool({
      description: 'Update the status of an existing appointment. Requires confirmation.',
      inputSchema: z.object({
        appointment_id: z.string().uuid(),
        status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']),
      }),
      needsApproval: true,
      execute: async ({ appointment_id, status }) => {
        try {
          const { error } = await supabase
            .from('appointments')
            .update({ status })
            .eq('id', appointment_id)
            .eq('trainer_id', userId)

          if (error) return { success: false, error: error.message }
          return { success: true, action: 'updated', entity: 'appointment', href: '/calendar' }
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
  }
}
