import { createClient } from '@/lib/supabase/server'
import ClientsClientSection from './ClientsClientSection'

export interface PackageOption {
  id: string
  name: string
  visit_count: number
}

export interface ClientListItem {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  package_id: string | null
  interview_notes: string | null
  plan_url: string | null
  packages: PackageOption | null
}

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: clientsData }, { data: packagesData }] = await Promise.all([
    supabase
      .from('clients')
      .select('*, packages(id, name, visit_count)')
      .eq('trainer_id', user!.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('packages')
      .select('id, name, visit_count')
      .eq('trainer_id', user!.id)
      .order('name', { ascending: true }),
  ])

  const clients: ClientListItem[] = (clientsData ?? []).map((c) => ({
    id: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
    phone: c.phone ?? null,
    email: c.email ?? null,
    package_id: c.package_id ?? null,
    interview_notes: c.interview_notes ?? null,
    plan_url: c.plan_url ?? null,
    packages: c.packages
      ? { id: (c.packages as PackageOption).id, name: (c.packages as PackageOption).name, visit_count: (c.packages as PackageOption).visit_count }
      : null,
  }))

  const packages: PackageOption[] = (packagesData ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    visit_count: p.visit_count,
  }))

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <ClientsClientSection clients={clients} packages={packages} />
    </div>
  )
}
