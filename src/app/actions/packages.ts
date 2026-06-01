'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { packageSchema } from './packageSchema'

export type PackageFormState =
  | { errors: { name?: string[]; visit_count?: string[]; price?: string[]; _form?: string[] } }
  | { success: true }
  | null


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

  if (!user) return { errors: { _form: ['Sesja wygasła'] } }

  const { error } = await supabase.from('packages').insert({
    trainer_id: user.id,
    name: result.data.name,
    visit_count: result.data.visit_count,
    price: result.data.price,
  })

  if (error) {
    return { errors: { _form: ['Nie udało się zapisać pakietu'] } }
  }

  revalidatePath('/packages')
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

  if (!user) return { errors: { _form: ['Sesja wygasła'] } }

  const { error } = await supabase
    .from('packages')
    .update({
      name: result.data.name,
      visit_count: result.data.visit_count,
      price: result.data.price,
    })
    .eq('id', id)
    .eq('trainer_id', user.id)

  if (error) {
    return { errors: { _form: ['Nie udało się zaktualizować pakietu'] } }
  }

  revalidatePath('/packages')
  return { success: true }
}

export async function deletePackageAction(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return

  await supabase
    .from('packages')
    .delete()
    .eq('id', id)
    .eq('trainer_id', user.id)

  revalidatePath('/packages')
}
