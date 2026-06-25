import { tool } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

const clientWriteSchema = z.object({
  first_name:      z.string().min(1),
  last_name:       z.string().min(1),
  phone:           z.string().optional(),
  email:           z.string().email().optional(),
  package_id:      z.string().uuid().optional(),
  interview_notes: z.string().optional(),
  plan_url:        z.string().url().optional(),
})

export function makeClientTools(supabase: SupabaseClient, userId: string) {
  return {
    create_client: tool({
      description: 'Add a new client. Requires confirmation.',
      inputSchema: clientWriteSchema,
      needsApproval: true,
      execute: async ({ first_name, last_name, phone, email, package_id, interview_notes, plan_url }) => {
        try {
          const { error } = await supabase.from('clients').insert({
            trainer_id:      userId,
            first_name,
            last_name,
            phone:           phone || null,
            email:           email || null,
            package_id:      package_id || null,
            interview_notes: interview_notes || null,
            plan_url:        plan_url || null,
          })

          if (error) return { success: false, error: error.message }
          return { success: true, action: 'created', entity: 'client', name: `${first_name} ${last_name}`, href: '/clients' }
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),

    update_client: tool({
      description: "Update an existing client's details. Requires confirmation.",
      inputSchema: clientWriteSchema.extend({
        client_id: z.string().uuid(),
      }),
      needsApproval: true,
      execute: async ({ client_id, first_name, last_name, phone, email, package_id, interview_notes, plan_url }) => {
        try {
          const { error } = await supabase
            .from('clients')
            .update({
              first_name,
              last_name,
              phone:           phone || null,
              email:           email || null,
              package_id:      package_id || null,
              interview_notes: interview_notes || null,
              plan_url:        plan_url || null,
            })
            .eq('id', client_id)
            .eq('trainer_id', userId)

          if (error) return { success: false, error: error.message }
          return { success: true, action: 'updated', entity: 'client', name: `${first_name} ${last_name}`, href: '/clients' }
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),

    delete_client: tool({
      description: 'Permanently delete a client and ALL their appointments. Irreversible. Requires confirmation.',
      inputSchema: z.object({
        client_id: z.string().uuid(),
      }),
      needsApproval: true,
      execute: async ({ client_id }) => {
        try {
          const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', client_id)
            .eq('trainer_id', userId)

          if (error) return { success: false, error: error.message }
          return { success: true, action: 'deleted', entity: 'client' }
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
  }
}
