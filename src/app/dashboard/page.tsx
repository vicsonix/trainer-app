import { createClient } from '@/lib/supabase/server'
import { logoutAction } from '@/app/actions/auth'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold mb-2">Zalogowano</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-8">{user?.email}</p>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-6 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900 transition-colors"
          >
            Wyloguj się
          </button>
        </form>
      </div>
    </div>
  )
}
