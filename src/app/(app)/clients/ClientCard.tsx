'use client'

import type { PackageOption } from './page'

interface ClientCardProps {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  packages: PackageOption | null
}

export default function ClientCard({
  first_name,
  last_name,
  phone,
  email,
  packages,
}: ClientCardProps) {
  return (
    <div className="group relative flex flex-col rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden transition-all duration-200 hover:ring-jungle-teal-400 hover:shadow-lg hover:shadow-jungle-teal-100/60 dark:hover:shadow-jungle-teal-950/60">
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-jungle-teal-500 to-jungle-teal-400" />

      <div className="flex flex-col gap-3 p-4 flex-1">
        {/* Header: name + placeholder action area */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-base leading-tight">
            {first_name} {last_name}
          </h3>
          {/* Action buttons — wired in Phase 4 */}
          <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Contact info */}
        {(phone || email) && (
          <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
            {phone && <span>{phone}</span>}
            {email && <span>{email}</span>}
          </div>
        )}

        {/* Package badge */}
        <div className="mt-auto pt-1">
          {packages ? (
            <span className="inline-flex items-center rounded-full bg-jungle-teal-100 dark:bg-jungle-teal-900/40 px-2.5 py-1 text-xs font-medium text-jungle-teal-700 dark:text-jungle-teal-300">
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
  )
}
