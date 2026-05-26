'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { registerAction } from '@/app/actions/auth'
import SubmitButton from '@/components/ui/SubmitButton'

export default function RegisterPage() {
  const [state, formAction] = useActionState(registerAction, null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [matchError, setMatchError] = useState('')

  function handleConfirmChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setConfirmPassword(val)
    setMatchError(val && val !== password ? 'Hasła nie są zgodne' : '')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (password !== confirmPassword) {
      e.preventDefault()
      setMatchError('Hasła nie są zgodne')
    }
  }

  const displayError = matchError || state?.error

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-center mb-8">Utwórz konto</h1>
        <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-zinc-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:focus:ring-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="confirm-password" className="text-sm font-medium">
              Powtórz hasło
            </label>
            <input
              id="confirm-password"
              name="confirm-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={handleConfirmChange}
              className="rounded-lg border border-zinc-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:focus:ring-white"
            />
          </div>
          {displayError && (
            <p role="alert" className="text-sm text-red-600">
              {displayError}
            </p>
          )}
          <SubmitButton label="Zarejestruj się" />
        </form>
        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Masz już konto?{' '}
          <Link href="/login" className="font-medium underline text-foreground">
            Zaloguj się
          </Link>
        </p>
      </div>
    </div>
  )
}
