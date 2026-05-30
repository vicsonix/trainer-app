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
    <div className="flex min-h-full flex-col bg-soft-linen-50 dark:bg-carbon-black-950">
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
