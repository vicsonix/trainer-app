'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { registerAction } from '@/app/actions/auth'
import SubmitButton from '@/components/SubmitButton'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

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
    <div className="relative flex min-h-full flex-col items-center justify-center px-4 py-12 overflow-hidden bg-soft-linen-50 dark:bg-carbon-black-950">

      {/* Decorative blobs */}
      <div className="absolute -top-28 -left-28 w-96 h-96 rounded-full bg-lobster-pink-300 dark:bg-lobster-pink-700 opacity-30 dark:opacity-20 blur-3xl" />
      <div className="absolute -top-10 -right-16 w-72 h-72 rounded-full bg-jungle-teal-300 dark:bg-jungle-teal-600 opacity-25 dark:opacity-20 blur-3xl" />
      <div className="absolute -bottom-20 -left-12 w-80 h-80 rounded-full bg-tiger-orange-200 dark:bg-tiger-orange-600 opacity-30 dark:opacity-15 blur-3xl" />
      <div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-full bg-lobster-pink-200 dark:bg-lobster-pink-800 opacity-25 dark:opacity-20 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-64 rounded-full bg-soft-linen-300 dark:bg-carbon-black-800 opacity-40 dark:opacity-30 blur-3xl" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm">

        {/* Brand header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-lobster-pink-400 to-lobster-pink-700 flex items-center justify-center shadow-lg mb-4">
            <span className="text-white font-bold text-2xl tracking-tight">T</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Utwórz konto</h1>
          <p className="text-sm text-muted-foreground mt-1">Dołącz do Trainer App już dziś</p>
        </div>

        {/* Glass card */}
        <div className="rounded-2xl border border-white/60 dark:border-carbon-black-700/60 shadow-xl overflow-hidden bg-white/70 dark:bg-carbon-black-900/70 backdrop-blur-md">
          {/* Accent stripe */}
          <div className="h-1 bg-gradient-to-r from-lobster-pink-600 via-lobster-pink-400 to-tiger-orange-400" />

          <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="h-11 px-3 bg-white/60 dark:bg-carbon-black-800/60 border-soft-linen-300 dark:border-carbon-black-600"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Hasło</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 px-3 bg-white/60 dark:bg-carbon-black-800/60 border-soft-linen-300 dark:border-carbon-black-600"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-password">Powtórz hasło</Label>
              <Input
                id="confirm-password"
                name="confirm-password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={handleConfirmChange}
                className="h-11 px-3 bg-white/60 dark:bg-carbon-black-800/60 border-soft-linen-300 dark:border-carbon-black-600"
              />
            </div>

            {displayError && (
              <p role="alert" className="text-sm text-destructive">
                {displayError}
              </p>
            )}

            <div className="pt-1">
              <SubmitButton label="Zarejestruj się" />
            </div>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Masz już konto?{' '}
          <Link
            href="/login"
            className="font-semibold text-lobster-pink-600 hover:text-lobster-pink-500 underline underline-offset-4 transition-colors"
          >
            Zaloguj się
          </Link>
        </p>
      </div>
    </div>
  )
}
