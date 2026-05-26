import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold mb-2">
        Witaj, {user?.email}
      </h1>
      <p className="text-zinc-500 dark:text-zinc-400">
        Wybierz sekcję z menu, aby rozpocząć pracę.
      </p>
    </div>
  )
}
