import { Button } from '@/components/ui/button'

interface ClientEmptyStateProps {
  onCreateClick: () => void
}

export default function ClientEmptyState({ onCreateClick }: ClientEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <div className="text-center">
        <p className="text-lg font-semibold text-foreground">
          Nie masz jeszcze żadnych klientów
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Dodaj pierwszego klienta, żeby zacząć śledzić postępy.
        </p>
      </div>

      <Button variant="gradient" size="lg" onClick={onCreateClick}>
        Dodaj pierwszego klienta
      </Button>
    </div>
  )
}
