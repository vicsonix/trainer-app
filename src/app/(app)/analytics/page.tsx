import { createClient } from '@/lib/supabase/server'

type Period = 'month' | '3months' | 'all'

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

type ApptRow = {
  status: string
  price: number | null
  package_id: string | null
}

type PackageRow = {
  id: string
  name: string
}

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
    .select('status, price, package_id')
    .eq('trainer_id', user!.id)

  if (from) {
    apptQuery = apptQuery.gte('starts_at', from)
  }

  const [{ data: apptData }, { data: pkgData }] = await Promise.all([
    apptQuery,
    supabase
      .from('packages')
      .select('id, name')
      .eq('trainer_id', user!.id),
  ])

  const appointments = (apptData ?? []) as ApptRow[]
  const packages = (pkgData ?? []) as PackageRow[]
  const packageMap = new Map(packages.map(p => [p.id, p.name]))

  const completed = appointments.filter(a => a.status === 'completed')
  const completedCount = completed.length
  const cancelledCount = appointments.filter(a => a.status === 'cancelled').length
  const noShowCount = appointments.filter(a => a.status === 'no_show').length

  const completedWithPrice = completed.filter(a => a.price !== null)
  const totalRevenue = completedWithPrice.reduce((sum, a) => sum + (a.price ?? 0), 0)
  const pricedCount = completedWithPrice.length

  const pkgCounts: Record<string, number> = {}
  for (const appt of completed) {
    if (appt.package_id) {
      pkgCounts[appt.package_id] = (pkgCounts[appt.package_id] ?? 0) + 1
    }
  }

  const packageUsage = Object.entries(pkgCounts)
    .map(([id, count]) => ({ id, name: packageMap.get(id) ?? 'Nieznany pakiet', count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Analityka</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Twoje statystyki treningowe</p>
      </div>

      <pre className="text-xs text-muted-foreground bg-soft-linen-100 dark:bg-carbon-black-800 rounded-lg p-4">
        {JSON.stringify({ period, completedCount, cancelledCount, noShowCount, totalRevenue, pricedCount, packageUsage }, null, 2)}
      </pre>
    </div>
  )
}
