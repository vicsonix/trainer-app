'use client'

import { Plus } from 'lucide-react'
import type { ClientListItem, PackageOption } from './page'
import ClientCard from './ClientCard'
import ClientEmptyState from './ClientEmptyState'

interface ClientsClientSectionProps {
  clients: ClientListItem[]
  packages: PackageOption[]
}

export default function ClientsClientSection({ clients }: ClientsClientSectionProps) {
  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-jungle-teal-600 to-jungle-teal-400 bg-clip-text text-transparent">
              Klienci
            </h1>
            {clients.length > 0 && (
              <span className="rounded-full bg-jungle-teal-100 dark:bg-jungle-teal-900/50 px-2.5 py-0.5 text-xs font-semibold text-jungle-teal-600 dark:text-jungle-teal-300">
                {clients.length}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Zarządzaj swoimi klientami
          </p>
        </div>

        <button
          disabled
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-jungle-teal-500 to-jungle-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm opacity-50 cursor-not-allowed"
        >
          <Plus size={15} />
          Dodaj klienta
        </button>
      </div>

      {clients.length === 0 ? (
        <ClientEmptyState onCreateClick={() => {}} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              id={client.id}
              first_name={client.first_name}
              last_name={client.last_name}
              phone={client.phone}
              email={client.email}
              packages={client.packages}
            />
          ))}
        </div>
      )}
    </>
  )
}
