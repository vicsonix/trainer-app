import { tool } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

const packageWriteSchema = z.object({
  name:        z.string().min(1),
  visit_count: z.number().int().positive(),
  price:       z.number().nonnegative().describe('Price in PLN'),
})

export function makePackageTools(supabase: SupabaseClient, userId: string) {
  return {
    create_package: tool({
      description: 'Create a new training package. Requires confirmation.',
      inputSchema: packageWriteSchema,
      needsApproval: true,
      execute: async ({ name, visit_count, price }) => {
        try {
          const { error } = await supabase.from('packages').insert({
            trainer_id: userId,
            name,
            visit_count,
            price,
          })

          if (error) return { success: false, error: error.message }
          return { success: true, action: 'created', entity: 'package', name, href: '/packages' }
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),

    update_package: tool({
      description: 'Update an existing training package. Requires confirmation.',
      inputSchema: packageWriteSchema.extend({
        package_id: z.string().uuid(),
      }),
      needsApproval: true,
      execute: async ({ package_id, name, visit_count, price }) => {
        try {
          const { error } = await supabase
            .from('packages')
            .update({ name, visit_count, price })
            .eq('id', package_id)
            .eq('trainer_id', userId)

          if (error) return { success: false, error: error.message }
          return { success: true, action: 'updated', entity: 'package', name, href: '/packages' }
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),

    delete_package: tool({
      description: 'Delete a training package. Requires confirmation.',
      inputSchema: z.object({
        package_id: z.string().uuid(),
      }),
      needsApproval: true,
      execute: async ({ package_id }) => {
        try {
          const { error } = await supabase
            .from('packages')
            .delete()
            .eq('id', package_id)
            .eq('trainer_id', userId)

          if (error) return { success: false, error: error.message }
          return { success: true, action: 'deleted', entity: 'package' }
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
  }
}
