'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export type PackageFormState =
  | { errors: { name?: string[]; visit_count?: string[]; price?: string[]; _form?: string[] } }
  | { success: true }
  | null

export const packageSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana'),
  visit_count: z.coerce.number().int().positive('Liczba wizyt musi być większa od zera'),
  price: z.coerce.number().min(0, 'Cena nie może być ujemna'),
})

export async function createPackageAction(
  _prevState: PackageFormState,
  formData: FormData
): Promise<PackageFormState> {
  const result = packageSchema.safeParse({
    name: formData.get('name'),
    visit_count: formData.get('visit_count'),
    price: formData.get('price'),
  })

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('packages').insert({
    trainer_id: user!.id,
    name: result.data.name,
    visit_count: result.data.visit_count,
    price: result.data.price,
  })

  if (error) {
    return { errors: { _form: ['Nie udało się zapisać pakietu'] } }
  }

  return { success: true }
}

export async function updatePackageAction(
  id: string,
  _prevState: PackageFormState,
  formData: FormData
): Promise<PackageFormState> {
  const result = packageSchema.safeParse({
    name: formData.get('name'),
    visit_count: formData.get('visit_count'),
    price: formData.get('price'),
  })

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('packages')
    .update({
      name: result.data.name,
      visit_count: result.data.visit_count,
      price: result.data.price,
    })
    .eq('id', id)
    .eq('trainer_id', user!.id)

  if (error) {
    return { errors: { _form: ['Nie udało się zaktualizować pakietu'] } }
  }

  return { success: true }
}

export async function deletePackageAction(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  await supabase
    .from('packages')
    .delete()
    .eq('id', id)
    .eq('trainer_id', user!.id)

  revalidatePath('/dashboard/packages')
}
