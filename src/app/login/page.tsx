'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { loginAction } from '@/app/actions/auth'
import SubmitButton from '@/components/ui/SubmitButton'

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, null)

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-center mb-8">Trainer App</h1>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-lg border border-zinc-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:focus:ring-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium">
              Hasło
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              className="rounded-lg border border-zinc-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:focus:ring-white"
            />
          </div>
          {state?.error && (
            <p role="alert" className="text-sm text-red-600">
              {state.error}
            </p>
          )}
          <SubmitButton label="Zaloguj się" />
        </form>
        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Nie masz konta?{' '}
          <Link href="/register" className="font-medium underline text-foreground">
            Zarejestruj się
          </Link>
        </p>
      </div>
    </div>
  )
}
