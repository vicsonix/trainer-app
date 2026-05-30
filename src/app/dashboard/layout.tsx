import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logoutAction } from '@/app/actions/auth'
import NavLink from '@/components/NavLink'

const navLinks = [
  { href: '/dashboard/packages', label: 'Pakiety' },
  { href: '/dashboard/clients', label: 'Klienci' },
  { href: '/dashboard/calendar', label: 'Kalendarz' },
  { href: '/dashboard/assistant', label: 'Asystent' },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex min-h-full flex-col">

      {/* Fixed blob background — same language as auth pages */}
      <div className="fixed inset-0 -z-10 bg-soft-linen-50 dark:bg-carbon-black-950 overflow-hidden">
        <div className="absolute -top-28 -left-28 w-96 h-96 rounded-full bg-lobster-pink-300 dark:bg-lobster-pink-700 opacity-30 dark:opacity-20 blur-3xl" />
        <div className="absolute -top-10 -right-16 w-72 h-72 rounded-full bg-jungle-teal-300 dark:bg-jungle-teal-600 opacity-25 dark:opacity-20 blur-3xl" />
        <div className="absolute -bottom-20 -left-12 w-80 h-80 rounded-full bg-tiger-orange-200 dark:bg-tiger-orange-600 opacity-30 blur-3xl" />
        <div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-full bg-lobster-pink-200 dark:bg-lobster-pink-800 opacity-25 dark:opacity-20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-72 rounded-full bg-soft-linen-300 dark:bg-carbon-black-800 opacity-40 dark:opacity-30 blur-3xl" />
      </div>

      <header className="sticky top-0 z-10 bg-white/80 dark:bg-carbon-black-900/80 backdrop-blur-md border-b border-soft-linen-200 dark:border-carbon-black-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            {/* Brand mark */}
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-lobster-pink-400 to-lobster-pink-700 flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-xs">T</span>
              </div>
              <span className="text-base font-semibold tracking-tight">Trainer</span>
            </div>
            <nav className="hidden sm:flex items-center gap-1">
              {navLinks.map(({ href, label }) => (
                <NavLink key={href} href={href} label={label} />
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-muted-foreground truncate max-w-[200px]">
              {user?.email}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md border border-soft-linen-300 px-3 py-1.5 text-sm font-medium text-carbon-black-600 hover:bg-soft-linen-100 dark:border-carbon-black-700 dark:text-carbon-black-300 dark:hover:bg-carbon-black-800 transition-colors"
              >
                Wyloguj
              </button>
            </form>
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="flex sm:hidden overflow-x-auto border-t border-soft-linen-200 dark:border-carbon-black-800 px-4 pb-2 pt-1 gap-1">
          {navLinks.map(({ href, label }) => (
            <NavLink key={href} href={href} label={label} />
          ))}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
