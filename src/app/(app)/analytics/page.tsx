import Link from 'next/link'
import {
  Users, CheckCircle2, TrendingUp, Ban, UserX, CalendarClock,
  BarChart2, Trophy, AlertTriangle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { StatCard } from '@/components/stat-card'

type Period = 'month' | '3months' | 'all'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'month',   label: 'Ten miesiąc' },
  { value: '3months', label: 'Ostatnie 3 miesiące' },
  { value: 'all',     label: 'Wszystko' },
]

const DAYS_PL  = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function computeFrom(period: Period): string | null {
  const now = new Date()
  if (period === 'month') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  }
  if (period === '3months') {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - 90)
    return d.toISOString()
  }
  return null
}

type ApptRow     = { status: string; price: number | null; package_id: string | null; client_id: string; starts_at: string }
type AllTimeAppt = { client_id: string; package_id: string | null; status: string }
type PackageRow  = { id: string; name: string; visit_count: number }
type ClientRow   = { id: string; package_id: string | null; first_name: string; last_name: string }


const AVATAR_GRADIENTS = [
  'from-lobster-pink-500 to-tiger-orange-400',
  'from-jungle-teal-500 to-jungle-teal-400',
  'from-tiger-orange-500 to-tiger-orange-400',
]

const BAR_COLORS = ['bg-lobster-pink-500', 'bg-jungle-teal-500', 'bg-tiger-orange-500', 'bg-lobster-pink-400', 'bg-jungle-teal-400']

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: rawPeriod = 'month' } = await searchParams
  const period: Period = rawPeriod === '3months' || rawPeriod === 'all' ? rawPeriod : 'month'
  const from = computeFrom(period)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let apptQuery = supabase
    .from('appointments')
    .select('status, price, package_id, client_id, starts_at')
    .eq('trainer_id', user!.id)

  if (from) apptQuery = apptQuery.gte('starts_at', from)

  const [{ data: apptData }, { data: allTimeData }, { data: pkgData }, { data: clientData }] = await Promise.all([
    apptQuery,
    supabase.from('appointments').select('client_id, package_id, status').eq('trainer_id', user!.id).in('status', ['completed', 'scheduled']),
    supabase.from('packages').select('id, name, visit_count').eq('trainer_id', user!.id),
    supabase.from('clients').select('id, package_id, first_name, last_name').eq('trainer_id', user!.id),
  ])

  const appointments = (apptData   ?? []) as ApptRow[]
  const allTime      = (allTimeData ?? []) as AllTimeAppt[]
  const packages     = (pkgData     ?? []) as PackageRow[]
  const clients      = (clientData  ?? []) as ClientRow[]
  const packageMap   = new Map(packages.map(p => [p.id, p]))
  const clientMap    = new Map(clients.map(c => [c.id, `${c.first_name} ${c.last_name}`]))

  // ── Period-scoped appointment stats ─────────────────────────────────────
  const completed      = appointments.filter(a => a.status === 'completed')
  const completedCount = completed.length
  const cancelledCount = appointments.filter(a => a.status === 'cancelled').length
  const noShowCount    = appointments.filter(a => a.status === 'no_show').length
  const scheduledCount = appointments.filter(a => a.status === 'scheduled').length

  const completedWithPrice = completed.filter(a => a.price !== null)
  const totalRevenue    = completedWithPrice.reduce((sum, a) => sum + (a.price ?? 0), 0)
  const pricedCount     = completedWithPrice.length
  const avgSessionPrice = pricedCount > 0 ? totalRevenue / pricedCount : null
  const totalClosed     = completedCount + cancelledCount + noShowCount
  const cancellationRate = totalClosed > 0
    ? Math.round(((cancelledCount + noShowCount) / totalClosed) * 100) : null

  // ── Client stats + retention ─────────────────────────────────────────────
  const totalClients       = clients.length
  const clientsWithPackage = clients.filter(c => c.package_id !== null).length

  // ── All-time session counts (for package depletion) ──────────────────────
  const allTimeCompleted: Record<string, number> = {}
  const allTimeScheduled: Record<string, number> = {}
  for (const a of allTime) {
    if (a.status === 'completed') allTimeCompleted[a.client_id] = (allTimeCompleted[a.client_id] ?? 0) + 1
    if (a.status === 'scheduled') allTimeScheduled[a.client_id] = (allTimeScheduled[a.client_id] ?? 0) + 1
  }

  // ── Clients with expiring packages (≤2 remaining) ────────────────────────
  type ExpiringClient = { clientId: string; name: string; pkgName: string; visitCount: number; usedCount: number; remaining: number }
  const expiringClients: ExpiringClient[] = []
  for (const c of clients) {
    if (!c.package_id) continue
    const pkg = packageMap.get(c.package_id)
    if (!pkg) continue
    const used      = (allTimeCompleted[c.id] ?? 0) + (allTimeScheduled[c.id] ?? 0)
    const remaining = pkg.visit_count - used
    if (remaining <= 2) {
      expiringClients.push({ clientId: c.id, name: `${c.first_name} ${c.last_name}`, pkgName: pkg.name, visitCount: pkg.visit_count, usedCount: used, remaining })
    }
  }
  expiringClients.sort((a, b) => a.remaining - b.remaining)

  // ── Top clients by completed sessions ────────────────────────────────────
  const sessionsByClient: Record<string, number> = {}
  const revenueByClient: Record<string, number>  = {}
  for (const a of completed) {
    sessionsByClient[a.client_id] = (sessionsByClient[a.client_id] ?? 0) + 1
    revenueByClient[a.client_id]  = (revenueByClient[a.client_id]  ?? 0) + (a.price ?? 0)
  }
  const topClients = Object.entries(sessionsByClient)
    .map(([id, count]) => ({ id, name: clientMap.get(id) ?? 'Nieznany', sessionCount: count, revenue: revenueByClient[id] ?? 0 }))
    .sort((a, b) => b.sessionCount - a.sessionCount)
    .slice(0, 3)

  // ── Day-of-week breakdown ─────────────────────────────────────────────────
  const dayCount: Record<number, number> = {}
  for (const a of completed) {
    const day = new Date(a.starts_at).getDay()
    dayCount[day] = (dayCount[day] ?? 0) + 1
  }
  const dayData     = DAY_ORDER.map((jsDay, i) => ({ label: DAYS_PL[i], count: dayCount[jsDay] ?? 0 }))
  const maxDayCount = Math.max(...dayData.map(d => d.count), 1)

  // ── Package popularity ────────────────────────────────────────────────────
  const clientsPerPkg: Record<string, number>  = {}
  const sessionsPerPkg: Record<string, number> = {}
  for (const c of clients)   if (c.package_id) clientsPerPkg[c.package_id]  = (clientsPerPkg[c.package_id]  ?? 0) + 1
  for (const a of completed) if (a.package_id) sessionsPerPkg[a.package_id] = (sessionsPerPkg[a.package_id] ?? 0) + 1

  const packageUsage = packages
    .filter(p => (clientsPerPkg[p.id] ?? 0) > 0)
    .map(p => ({ id: p.id, name: p.name, clientCount: clientsPerPkg[p.id] ?? 0, sessionCount: sessionsPerPkg[p.id] ?? 0 }))
    .sort((a, b) => b.clientCount - a.clientCount || b.sessionCount - a.sessionCount)
    .slice(0, 5)
  const maxClientCount = packageUsage[0]?.clientCount ?? 1

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Analityka</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Twoje statystyki treningowe</p>
      </div>

      {/* Period selector */}
      <div className="mb-8 flex rounded-lg border border-border overflow-hidden w-fit">
        {PERIODS.map(p => (
          <Link key={p.value} href={`?period=${p.value}`}
            className={cn('px-3 py-1.5 text-sm transition-colors',
              period === p.value ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <StatCard value={totalClients} label="Klientów łącznie"
          footnote={clientsWithPackage > 0 ? `${clientsWithPackage} z aktywnym pakietem` : undefined}
          icon={Users} iconBg="bg-jungle-teal-100 dark:bg-jungle-teal-900/40"
          iconColor="text-jungle-teal-600 dark:text-jungle-teal-400"
          valueColor="text-jungle-teal-700 dark:text-jungle-teal-300" />

        <StatCard value={completedCount} label="Sesji ukończonych"
          icon={CheckCircle2} iconBg="bg-lobster-pink-100 dark:bg-lobster-pink-900/40"
          iconColor="text-lobster-pink-600 dark:text-lobster-pink-400"
          valueColor="text-lobster-pink-600 dark:text-lobster-pink-400" />

        <StatCard value={`${totalRevenue.toFixed(2)} zł`} label="Przychód"
          footnote={avgSessionPrice !== null
            ? `Śr. ${avgSessionPrice.toFixed(0)} zł / sesja${pricedCount < completedCount ? ` · ${pricedCount} z ${completedCount} z ceną` : ''}`
            : undefined}
          icon={TrendingUp} iconBg="bg-tiger-orange-100 dark:bg-tiger-orange-900/40"
          iconColor="text-tiger-orange-600 dark:text-tiger-orange-400"
          valueColor="text-tiger-orange-700 dark:text-tiger-orange-400" />

        <StatCard value={cancelledCount} label="Odwołanych"
          footnote={cancellationRate !== null ? `${cancellationRate}% wskaźnik odwołań` : undefined}
          icon={Ban} iconBg="bg-lobster-pink-50 dark:bg-lobster-pink-950/50"
          iconColor="text-lobster-pink-400 dark:text-lobster-pink-300" />

        <StatCard value={noShowCount} label="Nieobecności"
          icon={UserX} iconBg="bg-soft-linen-100 dark:bg-carbon-black-800"
          iconColor="text-carbon-black-500 dark:text-carbon-black-400" />

        <StatCard value={scheduledCount} label="Zaplanowanych"
          icon={CalendarClock} iconBg="bg-jungle-teal-50 dark:bg-jungle-teal-900/30"
          iconColor="text-jungle-teal-500 dark:text-jungle-teal-400"
          valueColor="text-jungle-teal-600 dark:text-jungle-teal-300" />

      </div>

      {/* ── Day-of-week chart + Top clients ────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">

        {/* Day-of-week vertical bar chart */}
        <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-jungle-teal-400 to-jungle-teal-600" />
          <div className="p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-7 h-7 rounded-lg bg-jungle-teal-100 dark:bg-jungle-teal-900/40 flex items-center justify-center">
                <CalendarClock size={13} className="text-jungle-teal-600 dark:text-jungle-teal-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">Dni tygodnia</p>
                <p className="text-[10px] text-muted-foreground">Ukończone sesje</p>
              </div>
            </div>

            {completedCount === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Brak danych w tym okresie</p>
            ) : (
              <div className="flex items-end gap-1.5" style={{ height: '80px' }}>
                {dayData.map(({ label, count }) => {
                  const barPx  = Math.max(count > 0 ? 4 : 0, Math.round((count / maxDayCount) * 64))
                  const weekend = label === 'So' || label === 'Nd'
                  return (
                    <div key={label} className="flex-1 flex flex-col items-center justify-end gap-1.5">
                      {count > 0 && <span className="text-[9px] font-semibold text-muted-foreground">{count}</span>}
                      <div
                        className={cn('w-full rounded-t-sm', weekend ? 'bg-tiger-orange-400' : 'bg-jungle-teal-500')}
                        style={{ height: `${barPx}px` }}
                      />
                      <span className={cn('text-[10px]', weekend ? 'text-tiger-orange-500 dark:text-tiger-orange-400' : 'text-muted-foreground')}>
                        {label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Top clients leaderboard */}
        <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-tiger-orange-400 to-tiger-orange-600" />
          <div className="p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-7 h-7 rounded-lg bg-tiger-orange-100 dark:bg-tiger-orange-900/40 flex items-center justify-center">
                <Trophy size={13} className="text-tiger-orange-600 dark:text-tiger-orange-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">Najaktywniejsze osoby</p>
                <p className="text-[10px] text-muted-foreground">Według ukończonych sesji</p>
              </div>
            </div>

            {topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Brak danych w tym okresie</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {topClients.map((client, i) => {
                  const initials = client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                  return (
                    <li key={client.id} className="flex items-center gap-3">
                      <div className={cn(
                        'w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 text-white text-sm font-bold',
                        AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]
                      )}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{client.name}</p>
                        {client.revenue > 0 && (
                          <p className="text-[10px] text-muted-foreground">{client.revenue.toFixed(0)} zł</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-lg font-bold">{client.sessionCount}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">
                          {client.sessionCount === 1 ? 'sesja' : client.sessionCount < 5 ? 'sesje' : 'sesji'}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── Expiring packages ──────────────────────────────────────────────── */}
      {expiringClients.length > 0 && (
        <div className="rounded-xl bg-card ring-1 ring-destructive/30 overflow-hidden mb-6">
          <div className="h-0.5 bg-gradient-to-r from-destructive via-tiger-orange-500 to-tiger-orange-400" />
          <div className="p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle size={13} className="text-destructive" />
              </div>
              <div>
                <p className="text-sm font-semibold">Pakiety kończące się wkrótce</p>
                <p className="text-[10px] text-muted-foreground">Klienci z ≤ 2 pozostałymi sesjami</p>
              </div>
            </div>

            <ul className="flex flex-col gap-4">
              {expiringClients.map(({ clientId, name, pkgName, visitCount, usedCount, remaining }) => {
                const usedPct  = Math.min(100, Math.round((usedCount / visitCount) * 100))
                const isUrgent = remaining <= 0
                const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <li key={clientId} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-destructive/15 flex items-center justify-center shrink-0 text-xs font-bold text-destructive">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{pkgName}</p>
                      </div>
                      <div className="shrink-0">
                        <span className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold',
                          isUrgent
                            ? 'bg-destructive text-white'
                            : 'bg-tiger-orange-100 text-tiger-orange-700 dark:bg-tiger-orange-900/40 dark:text-tiger-orange-300'
                        )}>
                          {remaining <= 0 ? 'Brak sesji' : `${remaining} ${remaining === 1 ? 'sesja' : 'sesje'}`}
                        </span>
                      </div>
                    </div>
                    <div className="ml-11">
                      <div className="flex rounded-full bg-soft-linen-100 dark:bg-carbon-black-800 h-1.5 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', isUrgent ? 'bg-destructive' : 'bg-tiger-orange-400')}
                          style={{ width: `${usedPct}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-1">{usedCount} / {visitCount} sesji</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      {/* ── Package popularity ──────────────────────────────────────────────── */}
      <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
        <div className="h-0.5 bg-gradient-to-r from-lobster-pink-500 via-lobster-pink-400 to-tiger-orange-400" />
        <div className="p-5">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded-lg bg-lobster-pink-100 dark:bg-lobster-pink-900/40 flex items-center justify-center">
              <BarChart2 size={13} className="text-lobster-pink-600 dark:text-lobster-pink-400" />
            </div>
            <h2 className="text-sm font-semibold">Popularność pakietów</h2>
          </div>
          <p className="text-[10px] text-muted-foreground mb-5 pl-9">Liczba klientów z danym pakietem</p>

          {packages.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">Brak pakietów</p>
              <Link href="/packages" className="mt-2 inline-block text-sm font-medium text-lobster-pink-600 dark:text-lobster-pink-400 hover:underline">
                Dodaj pierwszy pakiet →
              </Link>
            </div>
          ) : packageUsage.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">Żaden pakiet nie ma jeszcze przypisanego klienta.</p>
              <Link href="/clients" className="mt-2 inline-block text-sm font-medium text-lobster-pink-600 dark:text-lobster-pink-400 hover:underline">
                Przypisz pakiet do klienta →
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {packageUsage.map((item, i) => (
                <li key={item.id} className="flex items-center gap-3">
                  <div className="w-36 shrink-0">
                    <span className="text-sm font-medium truncate block">{item.name}</span>
                    {item.sessionCount > 0 && (
                      <span className="text-[10px] text-muted-foreground">{item.sessionCount} sesji w okresie</span>
                    )}
                  </div>
                  <div className="flex-1 rounded-full bg-soft-linen-100 dark:bg-carbon-black-800 h-2">
                    <div
                      className={cn('h-2 rounded-full transition-all', BAR_COLORS[i % BAR_COLORS.length])}
                      style={{ width: `${(item.clientCount / maxClientCount) * 100}%` }}
                    />
                  </div>
                  <div className="w-20 text-right shrink-0">
                    <span className="text-sm font-bold">{item.clientCount}</span>
                    <span className="text-xs text-muted-foreground ml-1">{item.clientCount === 1 ? 'klient' : 'klientów'}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
