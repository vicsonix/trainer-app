'use server'

import { revalidatePath } from 'next/cache'
import type { ZodIssue } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { clientSchema } from './schema'

function issuesByField(issues: ZodIssue[]) {
  const out: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = issue.path[0]
    if (typeof key === 'string') (out[key] ??= []).push(issue.message)
  }
  return out
}

export type ClientFormState =
  | { errors: {
      first_name?: string[]
      last_name?: string[]
      phone?: string[]
      email?: string[]
      package_id?: string[]
      interview_notes?: string[]
      plan_url?: string[]
      _form?: string[]
    }}
  | { success: true }
  | null

function parseFormData(formData: FormData) {
  return clientSchema.safeParse({
    first_name:      formData.get('first_name'),
    last_name:       formData.get('last_name'),
    phone:           formData.get('phone'),
    email:           formData.get('email'),
    package_id:      formData.get('package_id'),
    interview_notes: formData.get('interview_notes'),
    plan_url:        formData.get('plan_url'),
  })
}

export async function createClientAction(
  _prevState: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const result = parseFormData(formData)

  if (!result.success) {
    return { errors: issuesByField(result.error.issues) }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { errors: { _form: ['Sesja wygasła'] } }

  const { error } = await supabase.from('clients').insert({
    trainer_id:      user.id,
    first_name:      result.data.first_name,
    last_name:       result.data.last_name,
    phone:           result.data.phone || null,
    email:           result.data.email || null,
    package_id:      result.data.package_id || null,
    interview_notes: result.data.interview_notes || null,
    plan_url:        result.data.plan_url || null,
  })

  if (error) {
    return { errors: { _form: ['Nie udało się zapisać klienta'] } }
  }

  revalidatePath('/clients')
  return { success: true }
}

export async function updateClientAction(
  id: string,
  _prevState: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const result = parseFormData(formData)

  if (!result.success) {
    return { errors: issuesByField(result.error.issues) }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { errors: { _form: ['Sesja wygasła'] } }

  const { error } = await supabase
    .from('clients')
    .update({
      first_name:      result.data.first_name,
      last_name:       result.data.last_name,
      phone:           result.data.phone || null,
      email:           result.data.email || null,
      package_id:      result.data.package_id || null,
      interview_notes: result.data.interview_notes || null,
      plan_url:        result.data.plan_url || null,
    })
    .eq('id', id)
    .eq('trainer_id', user.id)

  if (error) {
    return { errors: { _form: ['Nie udało się zaktualizować klienta'] } }
  }

  revalidatePath('/clients')
  return { success: true }
}

export async function deleteClientAction(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return

  await supabase
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('trainer_id', user.id)

  revalidatePath('/clients')
}
