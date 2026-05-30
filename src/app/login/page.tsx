'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Dumbbell, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { loginAction } from '@/app/actions/auth'
import SubmitButton from '@/components/SubmitButton'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, null)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center px-4 py-12 overflow-hidden bg-soft-linen-50 dark:bg-carbon-black-950">

      {/* Decorative blobs */}
      <div className="absolute -top-28 -left-28 w-96 h-96 rounded-full bg-lobster-pink-300 dark:bg-lobster-pink-700 opacity-30 dark:opacity-20 blur-3xl" />
      <div className="absolute -top-10 -right-16 w-72 h-72 rounded-full bg-jungle-teal-300 dark:bg-jungle-teal-600 opacity-25 dark:opacity-20 blur-3xl" />
      <div className="absolute -bottom-20 -left-12 w-80 h-80 rounded-full bg-tiger-orange-200 dark:bg-tiger-orange-600 opacity-30 dark:opacity-15 blur-3xl" />
      <div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-full bg-lobster-pink-200 dark:bg-lobster-pink-800 opacity-25 dark:opacity-20 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-64 rounded-full bg-soft-linen-300 dark:bg-carbon-black-800 opacity-40 dark:opacity-30 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">

        {/* Brand header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-lobster-pink-400 to-lobster-pink-700 flex items-center justify-center shadow-lg shadow-lobster-pink-200 dark:shadow-lobster-pink-950 mb-5">
            <Dumbbell size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
            Trainer App
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Zaloguj się do swojego konta</p>
        </div>

        {/* Glass card */}
        <div className="rounded-2xl border border-white/60 dark:border-carbon-black-700/60 shadow-xl overflow-hidden bg-white/70 dark:bg-carbon-black-900/70 backdrop-blur-md">
          <div className="h-1 bg-gradient-to-r from-lobster-pink-600 via-lobster-pink-400 to-tiger-orange-400" />

          <form action={formAction} className="flex flex-col gap-5 p-6">

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="h-11 pl-9 pr-3 bg-white/60 dark:bg-carbon-black-800/60 border-soft-linen-300 dark:border-carbon-black-600"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Hasło</Label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="current-password"
                  className="h-11 pl-9 pr-10 bg-white/60 dark:bg-carbon-black-800/60 border-soft-linen-300 dark:border-carbon-black-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {state?.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}

            <div className="pt-1">
              <SubmitButton label="Zaloguj się" />
            </div>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Nie masz konta?{' '}
          <Link
            href="/register"
            className="font-semibold text-jungle-teal-600 hover:text-jungle-teal-500 dark:text-jungle-teal-400 dark:hover:text-jungle-teal-300 underline underline-offset-4 transition-colors"
          >
            Zarejestruj się
          </Link>
        </p>
      </div>
    </div>
  )
}
