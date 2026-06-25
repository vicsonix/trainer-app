'use client'

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
      <div className="h-px bg-gradient-to-r from-lobster-pink-500 via-lobster-pink-400 to-tiger-orange-400" />

      <div className="flex flex-col gap-4 p-4">
        {/* Name + actions */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-tight">{name}</h3>
          <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
            <EditPackageModal id={id} name={name} visitCount={visitCount} price={price} />
            <DeletePackageDialog packageId={id} packageName={name} clientCount={clientCount} />
          </div>
        </div>

        {/* Stat blocks */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col rounded-lg bg-soft-linen-100 dark:bg-carbon-black-800 px-2.5 py-2 gap-0.5">
            <span className="text-base font-bold tracking-tight leading-none">{perSession}</span>
            <span className="text-[10px] text-muted-foreground">PLN / sesję</span>
          </div>

          <div className="flex flex-col rounded-lg bg-soft-linen-100 dark:bg-carbon-black-800 px-2.5 py-2 gap-0.5">
            <span className="text-base font-bold tracking-tight leading-none">{visitCount}</span>
            <span className="text-[10px] text-muted-foreground">{visitCount === 1 ? 'wizyta' : 'wizyt'}</span>
          </div>

          <div className="flex flex-col rounded-lg bg-soft-linen-100 dark:bg-carbon-black-800 px-2.5 py-2 gap-0.5">
            <span className="text-base font-bold tracking-tight leading-none">{clientCount}</span>
            <span className="text-[10px] text-muted-foreground">{clientCount === 1 ? 'klient' : 'klientów'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
