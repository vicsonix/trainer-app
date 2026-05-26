'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function mapSupabaseError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Nieprawidłowy email lub hasło'
  if (message.includes('User already registered')) return 'Konto z tym emailem już istnieje'
  return 'Wystąpił błąd. Spróbuj ponownie.'
}

export async function loginAction(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string }> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: mapSupabaseError(error.message) }
  }

  redirect('/dashboard')
}

export async function registerAction(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string }> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return { error: mapSupabaseError(error.message) }
  }

  redirect('/dashboard')
}

export async function logoutAction(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
