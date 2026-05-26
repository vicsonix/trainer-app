'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function mapSupabaseError(message: string | undefined): string {
  if (!message) return 'Wystąpił błąd. Spróbuj ponownie.'
  if (message.includes('Invalid login credentials')) return 'Nieprawidłowy email lub hasło'
  if (message.includes('User already registered')) return 'Konto z tym emailem już istnieje'
  if (message.includes('Password should be at least')) return 'Hasło musi mieć co najmniej 6 znaków'
  if (message.includes('email rate limit')) return 'Zbyt wiele prób rejestracji. Poczekaj chwilę i spróbuj ponownie.'
  if (message.includes('Email signups are disabled')) return 'Rejestracja przez email jest wyłączona. Skontaktuj się z administratorem.'
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
  const confirmPassword = formData.get('confirm-password') as string

  if (password !== confirmPassword) {
    return { error: 'Hasła nie są zgodne' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return { error: mapSupabaseError(error.message ?? error.toString()) }
  }

  redirect('/dashboard')
}

export async function logoutAction(): Promise<never> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()
  if (error) console.error('signOut error:', error.message)
  redirect('/login')
}
