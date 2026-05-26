import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logoutAction } from '@/app/actions/auth'

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
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-base font-semibold tracking-tight">Trainer</span>
            <nav className="hidden sm:flex items-center gap-1">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">
              {user?.email}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900 transition-colors"
              >
                Wyloguj
              </button>
            </form>
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="flex sm:hidden overflow-x-auto border-t border-zinc-100 dark:border-zinc-800 px-4 pb-2 pt-1 gap-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
