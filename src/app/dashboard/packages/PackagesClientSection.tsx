'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pakiety</h1>
        <Button onClick={() => openModal()}>Dodaj pakiet</Button>
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
