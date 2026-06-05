'use client'

import type { PackageOption } from './page'
import EditClientModal from './EditClientModal'
import DeleteClientDialog from './DeleteClientDialog'

interface ClientCardProps {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  package_id: string | null
  interview_notes: string | null
  plan_url: string | null
  packages: PackageOption | null
  allPackages: PackageOption[]
}

export default function ClientCard({
  id,
  first_name,
  last_name,
  phone,
  email,
  package_id,
  interview_notes,
  plan_url,
  packages,
  allPackages,
}: ClientCardProps) {
  const initials = `${first_name[0] ?? ''}${last_name[0] ?? ''}`.toUpperCase()

  return (
    <div className="group relative flex flex-col rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden transition-all duration-200 hover:ring-lobster-pink-400 hover:shadow-lg hover:shadow-lobster-pink-100/60 dark:hover:shadow-lobster-pink-950/60">
      <div className="h-px bg-gradient-to-r from-lobster-pink-500 via-lobster-pink-400 to-tiger-orange-400" />

      <div className="flex gap-3 p-4 flex-1">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-jungle-teal-400 to-jungle-teal-600 flex items-center justify-center shrink-0 shadow-sm">
          <span className="text-white font-semibold text-sm">{initials}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm leading-tight truncate">
              {first_name} {last_name}
            </h3>
            <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
              <EditClientModal
                id={id}
                first_name={first_name}
                last_name={last_name}
                phone={phone}
                email={email}
                package_id={package_id}
                interview_notes={interview_notes}
                plan_url={plan_url}
                packages={allPackages}
              />
              <DeleteClientDialog
                clientId={id}
                clientName={`${first_name} ${last_name}`}
              />
            </div>
          </div>

          {(phone || email) && (
            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              {phone && <span>{phone}</span>}
              {email && <span className="truncate">{email}</span>}
            </div>
          )}

          <div className="mt-auto pt-1">
            {packages ? (
              <span className="inline-flex items-center rounded-full bg-soft-linen-100 dark:bg-carbon-black-800 px-2.5 py-1 text-xs font-medium text-carbon-black-700 dark:text-carbon-black-300">
                {packages.name} · {packages.visit_count} wizyt
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-soft-linen-100 dark:bg-carbon-black-800 px-2.5 py-1 text-xs font-medium text-carbon-black-500 dark:text-carbon-black-400">
                Brak pakietu
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
