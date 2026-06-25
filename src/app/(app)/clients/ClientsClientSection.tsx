'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ClientListItem, PackageOption } from './page'
import ClientCard from './ClientCard'
import ClientEmptyState from './ClientEmptyState'
import ClientFormModal from './ClientFormModal'

interface ClientsClientSectionProps {
  clients: ClientListItem[]
  packages: PackageOption[]
}

export default function ClientsClientSection({ clients, packages }: ClientsClientSectionProps) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">
              Klienci
            </h1>
            {clients.length > 0 && (
              <span className="rounded-full bg-soft-linen-100 dark:bg-carbon-black-800 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                {clients.length}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Zarządzaj swoimi klientami
          </p>
        </div>

        <Button variant="gradient" onClick={() => setModalOpen(true)}>
          <Plus size={15} />
          Dodaj klienta
        </Button>
      </div>

      {clients.length === 0 ? (
        <ClientEmptyState onCreateClick={() => setModalOpen(true)} />
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
              package_id={client.package_id}
              interview_notes={client.interview_notes}
              plan_url={client.plan_url}
              packages={client.packages}
              allPackages={packages}
            />
          ))}
        </div>
      )}

      <ClientFormModal open={modalOpen} onOpenChange={setModalOpen} packages={packages} />
    </>
  )
}
