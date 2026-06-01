'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import PackageCard from './PackageCard'
import PackageEmptyState from './PackageEmptyState'
import PackageFormModal from './PackageFormModal'

interface Package {
  id: string
  name: string
  visit_count: number
  price: number
  clientCount: number
}

interface PackagesClientSectionProps {
  packages: Package[]
}

export default function PackagesClientSection({ packages }: PackagesClientSectionProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [defaultVisits, setDefaultVisits] = useState<number | undefined>()

  const openModal = (visits?: number) => {
    setDefaultVisits(visits)
    setModalOpen(true)
  }

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-lobster-pink-600 to-lobster-pink-400 bg-clip-text text-transparent">
              Pakiety
            </h1>
            {packages.length > 0 && (
              <span className="rounded-full bg-lobster-pink-100 dark:bg-lobster-pink-900/50 px-2.5 py-0.5 text-xs font-semibold text-lobster-pink-600 dark:text-lobster-pink-300">
                {packages.length}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Zarządzaj swoimi pakietami treningowymi
          </p>
        </div>

        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-lobster-pink-500 to-lobster-pink-600 hover:from-lobster-pink-600 hover:to-lobster-pink-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all"
        >
          <Plus size={15} />
          Dodaj pakiet
        </button>
      </div>

      {packages.length === 0 ? (
        <PackageEmptyState
          onPresetSelect={(visits) => openModal(visits)}
          onCreateClick={() => openModal()}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              id={pkg.id}
              name={pkg.name}
              visitCount={pkg.visit_count}
              price={pkg.price}
              clientCount={pkg.clientCount}
            />
          ))}
        </div>
      )}

      <PackageFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        defaultVisits={defaultVisits}
      />
    </>
  )
}
