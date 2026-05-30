interface PackageEmptyStateProps {
  onPresetSelect: (visits: number) => void
  onCreateClick: () => void
}

const presets = [
  {
    visits: 5,
    price: 400,
    accent: 'from-jungle-teal-500 to-jungle-teal-400',
    badge: 'bg-jungle-teal-100 text-jungle-teal-700 dark:bg-jungle-teal-900 dark:text-jungle-teal-300',
    ring: 'hover:ring-jungle-teal-400',
    label: 'Starter',
  },
  {
    visits: 10,
    price: 800,
    accent: 'from-tiger-orange-500 to-tiger-orange-400',
    badge: 'bg-tiger-orange-100 text-tiger-orange-700 dark:bg-tiger-orange-900/60 dark:text-tiger-orange-300',
    ring: 'hover:ring-tiger-orange-400',
    label: 'Popularny',
  },
  {
    visits: 20,
    price: 1400,
    accent: 'from-lobster-pink-500 to-lobster-pink-400',
    badge: 'bg-lobster-pink-100 text-lobster-pink-700 dark:bg-lobster-pink-900/60 dark:text-lobster-pink-300',
    ring: 'hover:ring-lobster-pink-400',
    label: 'Pro',
  },
]

export default function PackageEmptyState({
  onPresetSelect,
  onCreateClick,
}: PackageEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-8 py-12">
      <div className="text-center">
        <p className="text-lg font-semibold text-foreground">
          Nie masz jeszcze żadnych pakietów
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Zacznij od jednego z gotowych szablonów lub utwórz własny.
        </p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-3">
        {presets.map(({ visits, price, accent, badge, ring, label }) => (
          <button
            key={visits}
            onClick={() => onPresetSelect(visits)}
            className={`group text-left rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden transition-all duration-200 hover:shadow-md ${ring}`}
          >
            {/* Colored top bar */}
            <div className={`h-1 bg-gradient-to-r ${accent}`} />

            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{visits} wizyt</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge}`}>
                  {label}
                </span>
              </div>

              <div>
                <div className="text-2xl font-bold tracking-tight">
                  {(price / visits).toFixed(0)}
                  <span className="text-sm font-medium text-muted-foreground ml-1">PLN / sesja</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{price} PLN łącznie</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={onCreateClick}
        className="rounded-lg border border-soft-linen-300 px-4 py-2 text-sm font-medium hover:bg-soft-linen-100 dark:border-carbon-black-700 dark:hover:bg-carbon-black-800 transition-colors"
      >
        Utwórz własny pakiet
      </button>
    </div>
  )
}
