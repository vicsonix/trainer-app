'use client'

import { Users } from 'lucide-react'
import EditPackageModal from './EditPackageModal'
import DeletePackageDialog from './DeletePackageDialog'

interface PackageCardProps {
  id: string
  name: string
  visitCount: number
  price: number
  clientCount: number
}

export default function PackageCard({
  id,
  name,
  visitCount,
  price,
  clientCount,
}: PackageCardProps) {
  const perSession = visitCount > 0 ? (price / visitCount).toFixed(2) : '0.00'

  return (
    <div className="group relative flex flex-col rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden transition-all duration-200 hover:ring-lobster-pink-400 hover:shadow-lg hover:shadow-lobster-pink-100/60 dark:hover:shadow-lobster-pink-950/60">
      {/* Gradient top accent */}
      <div className="h-1 bg-gradient-to-r from-lobster-pink-500 via-lobster-pink-400 to-tiger-orange-400" />

      <div className="flex flex-col gap-4 p-4 flex-1">
        {/* Header: name + action icons */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-base leading-tight">{name}</h3>
          <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
            <EditPackageModal id={id} name={name} visitCount={visitCount} price={price} />
            <DeletePackageDialog packageId={id} packageName={name} clientCount={clientCount} />
          </div>
        </div>

        {/* Hero: per-session price */}
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tracking-tight">{perSession}</span>
            <span className="text-sm font-medium text-muted-foreground">PLN</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">za sesję</p>
        </div>

        {/* Secondary stats */}
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-soft-linen-100 dark:bg-carbon-black-800 px-2.5 py-1 text-xs font-medium text-carbon-black-700 dark:text-carbon-black-300">
            {visitCount} {visitCount === 1 ? 'wizyta' : 'wizyt'}
          </span>
          <span className="inline-flex items-center rounded-full bg-soft-linen-100 dark:bg-carbon-black-800 px-2.5 py-1 text-xs font-medium text-carbon-black-700 dark:text-carbon-black-300">
            {price.toFixed(2)} PLN łącznie
          </span>
        </div>
      </div>

      {/* Footer: client count — teal when active */}
      <div className={`border-t border-border px-4 py-2.5 flex items-center gap-1.5 text-xs transition-colors ${
        clientCount > 0
          ? 'bg-jungle-teal-50 dark:bg-jungle-teal-900/20 text-jungle-teal-700 dark:text-jungle-teal-300'
          : 'bg-muted/50 text-muted-foreground'
      }`}>
        <Users size={12} />
        <span>
          {clientCount === 0
            ? 'Brak klientów'
            : `${clientCount} ${clientCount === 1 ? 'klient' : 'klientów'}`}
        </span>
      </div>
    </div>
  )
}
