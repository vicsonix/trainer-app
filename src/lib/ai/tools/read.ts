import { tool } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export function makeReadTools(supabase: SupabaseClient, userId: string) {
  return {
    list_clients: tool({
      description: 'List all clients for this trainer, including their package info.',
      inputSchema: z.object({}),
      execute: async () => {
        const { data, error } = await supabase
          .from('clients')
          .select('*, packages(name, visit_count, price)')
          .eq('trainer_id', userId)
          .order('created_at', { ascending: false })

        if (error) return { success: false, error: error.message }
        return { success: true, clients: data ?? [] }
      },
    }),

    list_appointments: tool({
      description: 'List appointments for a date range. Defaults to past 7 days and next 30 days.',
      inputSchema: z.object({
        from_date: z.string().optional().describe('YYYY-MM-DD (default: 7 days ago)'),
        to_date:   z.string().optional().describe('YYYY-MM-DD (default: 30 days from now)'),
      }),
      execute: async ({ from_date, to_date }) => {
        const now = Date.now()
        const from = from_date ?? new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        const to   = to_date   ?? new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

        const { data, error } = await supabase
          .from('appointments')
          .select('*, clients(first_name, last_name)')
          .eq('trainer_id', userId)
          .gte('starts_at', `${from}T00:00:00`)
          .lte('starts_at', `${to}T23:59:59`)
          .order('starts_at', { ascending: true })

        if (error) return { success: false, error: error.message }
        return { success: true, appointments: data ?? [] }
      },
    }),

    get_stats: tool({
      description: 'Get aggregate statistics: completed visits, cancellations, and revenue.',
      inputSchema: z.object({
        period: z.enum(['this_month', 'last_3_months', 'all_time']),
      }),
      execute: async ({ period }) => {
        let fromDate: string | undefined
        const now = new Date()
        if (period === 'this_month') {
          fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        } else if (period === 'last_3_months') {
          fromDate = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString()
        }

        let query = supabase
          .from('appointments')
          .select('status, price')
          .eq('trainer_id', userId)
        if (fromDate) query = query.gte('starts_at', fromDate)

        const { data, error } = await query
        if (error) return { success: false, error: error.message }

        const rows = data ?? []
        const completed = rows.filter(r => r.status === 'completed')
        const cancelled = rows.filter(r => r.status === 'cancelled' || r.status === 'no_show')

        return {
          success: true,
          period,
          completed_visits:  completed.length,
          cancelled_no_show: cancelled.length,
          revenue_pln:       completed.reduce((s, r) => s + (r.price ?? 0), 0),
        }
      },
    }),

    get_client: tool({
      description: 'Get full details for a single client, including package info and remaining visits.',
      inputSchema: z.object({
        client_id: z.string().uuid(),
      }),
      execute: async ({ client_id }) => {
        const [clientResult, apptResult] = await Promise.all([
          supabase
            .from('clients')
            .select('*, packages(id, name, visit_count, price)')
            .eq('id', client_id)
            .eq('trainer_id', userId)
            .single(),
          supabase
            .from('appointments')
            .select('id, starts_at, ends_at, status, notes, package_id')
            .eq('client_id', client_id)
            .eq('trainer_id', userId)
            .order('starts_at', { ascending: true }),
        ])

        if (clientResult.error) return { success: false, error: clientResult.error.message }

        const client = clientResult.data
        const appointments = apptResult.data ?? []

        let remainingVisits: number | null = null
        if (client.packages) {
          const pkg = client.packages as { id: string; visit_count: number }
          const completedCount = appointments.filter(
            a => a.status === 'completed' && a.package_id === pkg.id
          ).length
          const scheduledCount = appointments.filter(
            a => a.status === 'scheduled' && a.package_id === pkg.id
          ).length
          remainingVisits = pkg.visit_count - completedCount - scheduledCount
        }

        return {
          success: true,
          client: { ...client, remaining_visits: remainingVisits },
          recent_appointments: appointments.slice(-5),
        }
      },
    }),
  }
}
