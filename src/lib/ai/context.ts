import type { SupabaseClient } from '@supabase/supabase-js'
import { log } from '@/lib/logger'

export const MAX_CONTEXT_CHARS = 12_000

export async function buildTrainerContext(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  try {
    const [clientsResult, appointmentsResult, packagesResult] = await Promise.all([
      supabase
        .from('clients')
        .select('*, packages(name, visit_count, price)')
        .eq('trainer_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('appointments')
        .select('*, clients(first_name, last_name)')
        .eq('trainer_id', userId)
        .gte('starts_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .lte('starts_at', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('starts_at', { ascending: true }),
      supabase
        .from('packages')
        .select('*')
        .eq('trainer_id', userId)
        .order('name', { ascending: true }),
    ])

    const clients = clientsResult.data ?? []
    const appointments = appointmentsResult.data ?? []
    const packages = packagesResult.data ?? []

    const NOTES_LIMIT = 500

    const packageBlock = packages.length > 0
      ? `=== PACKAGES ===\n${packages.map(p =>
          `${p.name} (${p.visit_count} visits, ${p.price} PLN)`
        ).join('\n')}`
      : ''

    const clientLines = clients.map(c => {
      const pkg = c.packages
        ? `Package: ${c.packages.name} (${c.packages.visit_count} visits, ${c.packages.price} PLN)`
        : 'Package: none'
      const notes = c.interview_notes
        ? `Notes: ${c.interview_notes.slice(0, NOTES_LIMIT)}${c.interview_notes.length > NOTES_LIMIT ? '…' : ''}`
        : ''
      const parts = [
        `- ${c.first_name} ${c.last_name} (id: ${c.id})`,
        `  ${pkg}`,
        notes ? `  ${notes}` : null,
        c.email ? `  Email: ${c.email}` : null,
        c.phone ? `  Phone: ${c.phone}` : null,
      ].filter(Boolean)
      return parts.join('\n')
    })

    const clientBlock = clients.length > 0
      ? `=== CLIENTS ===\n${clientLines.join('\n\n')}`
      : '=== CLIENTS ===\nNo clients yet.'

    const apptLines = appointments.map(a => {
      const client = a.clients
        ? `${a.clients.first_name} ${a.clients.last_name}`
        : 'Unknown'
      const start = new Date(a.starts_at).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })
      return `- ${start} | ${client} | ${a.status}${a.notes ? ` | ${a.notes}` : ''}`
    })

    let apptBlock = appointments.length > 0
      ? `=== APPOINTMENTS (past 90 days + next 30 days) ===\n${apptLines.join('\n')}`
      : '=== APPOINTMENTS ===\nNo appointments in this window.'

    let context = [packageBlock, clientBlock, apptBlock].filter(Boolean).join('\n\n')

    if (context.length > MAX_CONTEXT_CHARS) {
      // Truncate by dropping oldest appointments first
      while (context.length > MAX_CONTEXT_CHARS && apptLines.length > 0) {
        apptLines.shift()
        apptBlock = apptLines.length > 0
          ? `=== APPOINTMENTS (past 90 days + next 30 days) ===\n${apptLines.join('\n')}`
          : '=== APPOINTMENTS ===\nNo appointments in this window.'
        context = [packageBlock, clientBlock, apptBlock].filter(Boolean).join('\n\n')
      }
    }

    if (context.length > MAX_CONTEXT_CHARS) {
      context = context.slice(0, MAX_CONTEXT_CHARS)
    }

    return context || 'No client data available.'
  } catch (err) {
    log('error', 'build_trainer_context_failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return 'No client data available.'
  }
}
