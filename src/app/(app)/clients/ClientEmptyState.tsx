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

      <button
        onClick={onCreateClick}
        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-jungle-teal-500 to-jungle-teal-600 hover:from-jungle-teal-600 hover:to-jungle-teal-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all"
      >
        Dodaj pierwszego klienta
      </button>
    </div>
  )
}
