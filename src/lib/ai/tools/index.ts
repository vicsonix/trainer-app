import type { SupabaseClient } from '@supabase/supabase-js'
import { makeReadTools } from './read'
import { makeAppointmentTools } from './appointments'
import { makeClientTools } from './clients'
import { makePackageTools } from './packages'

export function makeTools(supabase: SupabaseClient, userId: string) {
  return {
    ...makeReadTools(supabase, userId),
    ...makeAppointmentTools(supabase, userId),
    ...makeClientTools(supabase, userId),
    ...makePackageTools(supabase, userId),
  }
}
