import { createClient } from '@/lib/supabase/server'
import PackagesClientSection from './PackagesClientSection'

export default async function PackagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('packages')
    .select('*, clients(count)')
    .eq('trainer_id', user!.id)
    .order('created_at', { ascending: false })

  const packages = (data ?? []).map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    visit_count: pkg.visit_count,
    price: Number(pkg.price),
    clientCount: (pkg.clients as { count: number }[] | null)?.[0]?.count ?? 0,
  }))

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PackagesClientSection packages={packages} />
    </div>
  )
}
