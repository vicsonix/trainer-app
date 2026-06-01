import { redirect } from 'next/navigation'
import { Dumbbell } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { logoutAction } from '@/app/actions/auth'
import NavLink from '@/components/NavLink'

const navLinks = [
  { href: '/dashboard', label: 'Panel' },
  { href: '/packages',  label: 'Pakiety' },
  { href: '/clients',   label: 'Klienci' },
  { href: '/calendar',  label: 'Kalendarz' },
  { href: '/assistant', label: 'Asystent' },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex min-h-full">

      {/* Blob background */}
      <div className="fixed inset-0 -z-10 bg-soft-linen-50 dark:bg-carbon-black-950 overflow-hidden">
        <div className="absolute -top-28 -left-28 w-96 h-96 rounded-full bg-lobster-pink-300 dark:bg-lobster-pink-700 opacity-30 dark:opacity-20 blur-3xl" />
        <div className="absolute -top-10 -right-16 w-72 h-72 rounded-full bg-jungle-teal-300 dark:bg-jungle-teal-600 opacity-25 dark:opacity-20 blur-3xl" />
        <div className="absolute -bottom-20 -left-12 w-80 h-80 rounded-full bg-tiger-orange-200 dark:bg-tiger-orange-600 opacity-30 blur-3xl" />
        <div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-full bg-lobster-pink-200 dark:bg-lobster-pink-800 opacity-25 dark:opacity-20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-72 rounded-full bg-soft-linen-300 dark:bg-carbon-black-800 opacity-40 dark:opacity-30 blur-3xl" />
      </div>

      {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
      <aside className="hidden md:flex w-56 flex-col fixed inset-y-0 left-0 z-10 border-r border-soft-linen-200 dark:border-carbon-black-800 bg-white/80 dark:bg-carbon-black-900/80 backdrop-blur-md">

        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-soft-linen-200 dark:border-carbon-black-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-lobster-pink-400 to-lobster-pink-700 flex items-center justify-center shadow-sm">
            <Dumbbell size={15} className="text-white" />
          </div>
          <span className="text-base font-semibold tracking-tight">Trainer</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
          {navLinks.map(({ href, label }) => (
            <NavLink key={href} href={href} label={label} />
          ))}
        </nav>

        {/* User + logout */}
        <div className="border-t border-soft-linen-200 dark:border-carbon-black-800 p-3 space-y-2">
          <p className="text-xs text-muted-foreground truncate px-3">
            {user.email}
          </p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-carbon-black-600 hover:bg-soft-linen-100 dark:text-carbon-black-300 dark:hover:bg-carbon-black-800 transition-colors"
            >
              Wyloguj
            </button>
          </form>
        </div>
      </aside>

      {/* ── Mobile top bar ────────────────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-carbon-black-900/80 backdrop-blur-md border-b border-soft-linen-200 dark:border-carbon-black-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-lobster-pink-400 to-lobster-pink-700 flex items-center justify-center shadow-sm">
            <Dumbbell size={13} className="text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Trainer</span>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-md border border-soft-linen-300 px-3 py-1.5 text-xs font-medium text-carbon-black-600 hover:bg-soft-linen-100 dark:border-carbon-black-700 dark:text-carbon-black-300 dark:hover:bg-carbon-black-800 transition-colors"
          >
            Wyloguj
          </button>
        </form>
      </header>

      {/* ── Mobile bottom nav ─────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-10 flex border-t border-soft-linen-200 dark:border-carbon-black-800 bg-white/80 dark:bg-carbon-black-900/80 backdrop-blur-sm safe-area-inset-bottom">
        {navLinks.map(({ href, label }) => (
          <NavLink key={href} href={href} label={label} variant="bottom-bar" />
        ))}
      </nav>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="flex-1 md:pl-56 pt-14 md:pt-0 pb-16 md:pb-0">
        {children}
      </main>
    </div>
  )
}
