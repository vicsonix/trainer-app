import Link from 'next/link'
import { Package, Users, CalendarDays, Bot, CheckCircle2, TrendingUp, CalendarClock, XCircle, UserX } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/stat-card'
import { cn } from '@/lib/utils'

const sections = [
  {
    label: 'Pakiety',
    href: '/packages',
    icon: Package,
    iconBg: 'bg-lobster-pink-100 dark:bg-lobster-pink-900/40',
    iconColor: 'text-lobster-pink-600 dark:text-lobster-pink-400',
    hoverRing: 'hover:ring-lobster-pink-300 dark:hover:ring-lobster-pink-800',
    hoverBg: 'hover:bg-lobster-pink-50/60 dark:hover:bg-lobster-pink-900/10',
  },
  {
    label: 'Klienci',
    href: '/clients',
    icon: Users,
    iconBg: 'bg-jungle-teal-100 dark:bg-jungle-teal-900/40',
    iconColor: 'text-jungle-teal-600 dark:text-jungle-teal-400',
    hoverRing: 'hover:ring-jungle-teal-300 dark:hover:ring-jungle-teal-800',
    hoverBg: 'hover:bg-jungle-teal-50/60 dark:hover:bg-jungle-teal-900/10',
  },
  {
    label: 'Kalendarz',
    href: '/calendar',
    icon: CalendarDays,
    iconBg: 'bg-tiger-orange-100 dark:bg-tiger-orange-900/40',
    iconColor: 'text-tiger-orange-600 dark:text-tiger-orange-400',
    hoverRing: 'hover:ring-tiger-orange-300 dark:hover:ring-tiger-orange-800',
    hoverBg: 'hover:bg-tiger-orange-50/60 dark:hover:bg-tiger-orange-900/10',
  },
  {
    label: 'Asystent',
    href: '/assistant',
    icon: Bot,
    iconBg: 'bg-soft-linen-200 dark:bg-carbon-black-800',
    iconColor: 'text-carbon-black-600 dark:text-carbon-black-300',
    hoverRing: 'hover:ring-soft-linen-400 dark:hover:ring-carbon-black-600',
    hoverBg: 'hover:bg-soft-linen-100/60 dark:hover:bg-carbon-black-800/30',
  },
]

type ApptWithClient = {
  id: string
  starts_at: string
  ends_at: string | null
  status: string
  clients: { first_name: string; last_name: string } | null
}

const STATUS_LABELS: Record<string, string> = {
  completed: 'Ukończona',
  cancelled: 'Odwołana',
  no_show: 'Nieobecność',
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', timeZone: 'Europe/Warsaw' })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now        = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const todayEnd   = new Date(todayStart); todayEnd.setUTCDate(todayEnd.getUTCDate() + 1)
  const weekDay    = (todayStart.getUTCDay() + 6) % 7 // 0=Mon … 6=Sun
  const weekStart  = new Date(todayStart); weekStart.setUTCDate(todayStart.getUTCDate() - weekDay)
  const weekEnd    = new Date(weekStart);  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const [
    { data: upcomingData },
    { data: recentData },
    { data: weeklyData },
    { data: monthlyData },
    { count: activeClientsCount },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, starts_at, ends_at, status, clients(first_name, last_name)')
      .eq('trainer_id', user!.id)
      .eq('status', 'scheduled')
      .gte('starts_at', todayStart.toISOString())
      .order('starts_at', { ascending: true })
      .limit(8),
    supabase
      .from('appointments')
      .select('id, starts_at, ends_at, status, clients(first_name, last_name)')
      .eq('trainer_id', user!.id)
      .in('status', ['completed', 'cancelled', 'no_show'])
      .order('starts_at', { ascending: false })
      .limit(5),
    supabase
      .from('appointments')
      .select('id')
      .eq('trainer_id', user!.id)
      .eq('status', 'completed')
      .gte('starts_at', weekStart.toISOString())
      .lt('starts_at', weekEnd.toISOString()),
    supabase
      .from('appointments')
      .select('price')
      .eq('trainer_id', user!.id)
      .eq('status', 'completed')
      .gte('starts_at', monthStart.toISOString()),
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('trainer_id', user!.id)
      .not('package_id', 'is', null),
  ])

  const upcoming: ApptWithClient[] = (upcomingData ?? []) as unknown as ApptWithClient[]
  const recent: ApptWithClient[]   = (recentData   ?? []) as unknown as ApptWithClient[]

  const visitsThisWeek   = (weeklyData ?? []).length
  const revenueThisMonth = (monthlyData ?? []).reduce((s, a) => s + (a.price ?? 0), 0)

  const todayIso  = todayEnd.toISOString()
  const todayAppts = upcoming.filter(a => a.starts_at < todayIso)
  const nextAppts  = upcoming.filter(a => a.starts_at >= todayIso).slice(0, 3)

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      {/* Header */}
      <div className="max-w-lg mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-lobster-pink-100 dark:bg-lobster-pink-900/50 px-3 py-1 text-xs font-semibold text-lobster-pink-600 dark:text-lobster-pink-300 mb-5">
          <span className="size-1.5 rounded-full bg-lobster-pink-500 animate-pulse" />
          Panel trenera
        </div>

        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent mb-3">
          Witaj z powrotem!
        </h1>

        <p className="text-base text-muted-foreground leading-relaxed">
          Oto podsumowanie Twojego tygodnia.
        </p>
      </div>

      {/* Nav quick-access */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
        {sections.map(({ label, href, icon: Icon, iconBg, iconColor, hoverRing, hoverBg }) => (
          <a
            key={href}
            href={href}
            className={`flex flex-col gap-3 rounded-xl bg-card ring-1 ring-foreground/10 p-4 transition-all duration-200 hover:shadow-md ${hoverRing} ${hoverBg}`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
              <Icon size={18} className={iconColor} />
            </div>
            <span className="text-sm font-medium">{label}</span>
          </a>
        ))}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard
          value={visitsThisWeek}
          label="Sesji w tym tygodniu"
          icon={CheckCircle2}
          iconBg="bg-jungle-teal-100 dark:bg-jungle-teal-900/40"
          iconColor="text-jungle-teal-600 dark:text-jungle-teal-400"
          valueColor="text-jungle-teal-700 dark:text-jungle-teal-300"
        />
        <StatCard
          value={`${revenueThisMonth.toFixed(2)} zł`}
          label="Przychód w tym miesiącu"
          icon={TrendingUp}
          iconBg="bg-tiger-orange-100 dark:bg-tiger-orange-900/40"
          iconColor="text-tiger-orange-600 dark:text-tiger-orange-400"
          valueColor="text-tiger-orange-700 dark:text-tiger-orange-400"
        />
        <StatCard
          value={activeClientsCount ?? 0}
          label="Aktywnych klientów"
          icon={Users}
          iconBg="bg-lobster-pink-100 dark:bg-lobster-pink-900/40"
          iconColor="text-lobster-pink-600 dark:text-lobster-pink-400"
          valueColor="text-lobster-pink-600 dark:text-lobster-pink-400"
        />
      </div>

      {/* Activity grid */}
      <div className="grid gap-4 lg:grid-cols-2 mb-8">

        {/* Upcoming appointments */}
        <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-tiger-orange-400 to-tiger-orange-600" />
          <div className="p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-7 h-7 rounded-lg bg-tiger-orange-100 dark:bg-tiger-orange-900/40 flex items-center justify-center">
                <CalendarClock size={13} className="text-tiger-orange-600 dark:text-tiger-orange-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">Nadchodzące wizyty</p>
                <p className="text-[10px] text-muted-foreground">Dziś i najbliższe dni</p>
              </div>
            </div>

            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Brak nadchodzących wizyt —{' '}
                <Link href="/calendar" className="font-medium text-lobster-pink-600 dark:text-lobster-pink-400 hover:underline">
                  Zaplanuj wizytę →
                </Link>
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {todayAppts.length > 0 && (
                  <li className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Dziś</li>
                )}
                {todayAppts.map(a => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-sm font-medium tabular-nums text-tiger-orange-600 dark:text-tiger-orange-400">
                      {formatTime(a.starts_at)}
                    </span>
                    <span className="text-sm flex-1 truncate text-right">
                      {a.clients ? `${a.clients.first_name} ${a.clients.last_name}` : '—'}
                    </span>
                  </li>
                ))}
                {nextAppts.length > 0 && (
                  <li className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-2 mb-1">Wkrótce</li>
                )}
                {nextAppts.map(a => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-sm font-medium tabular-nums text-muted-foreground">
                      {formatDate(a.starts_at)} {formatTime(a.starts_at)}
                    </span>
                    <span className="text-sm flex-1 truncate text-right">
                      {a.clients ? `${a.clients.first_name} ${a.clients.last_name}` : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-jungle-teal-400 to-jungle-teal-600" />
          <div className="p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-7 h-7 rounded-lg bg-jungle-teal-100 dark:bg-jungle-teal-900/40 flex items-center justify-center">
                <CheckCircle2 size={13} className="text-jungle-teal-600 dark:text-jungle-teal-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">Ostatnia aktywność</p>
                <p className="text-[10px] text-muted-foreground">Ostatnio zakończone i odwołane</p>
              </div>
            </div>

            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Brak ostatniej aktywności —{' '}
                <Link href="/calendar" className="font-medium text-lobster-pink-600 dark:text-lobster-pink-400 hover:underline">
                  Dodaj wizytę →
                </Link>
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {recent.map(a => {
                  const isCompleted = a.status === 'completed'
                  const StatusIcon = isCompleted ? CheckCircle2 : a.status === 'no_show' ? UserX : XCircle
                  return (
                    <li key={a.id} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                      <StatusIcon
                        size={14}
                        className={cn(
                          'shrink-0',
                          isCompleted
                            ? 'text-jungle-teal-500 dark:text-jungle-teal-400'
                            : 'text-destructive'
                        )}
                      />
                      <span className="text-sm flex-1 truncate">
                        {a.clients ? `${a.clients.first_name} ${a.clients.last_name}` : '—'}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(a.starts_at)}</span>
                      <span className={cn(
                        'shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        isCompleted
                          ? 'bg-jungle-teal-100 text-jungle-teal-700 dark:bg-jungle-teal-900/40 dark:text-jungle-teal-300'
                          : 'bg-destructive/10 text-destructive'
                      )}>
                        {STATUS_LABELS[a.status] ?? a.status}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
