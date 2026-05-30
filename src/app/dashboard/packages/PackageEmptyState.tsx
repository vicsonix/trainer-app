import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const presets = [
  { visits: 5, price: 400 },
  { visits: 10, price: 800 },
  { visits: 20, price: 1400 },
]

interface PackageEmptyStateProps {
  onPresetSelect: (visits: number) => void
  onCreateClick: () => void
}

export default function PackageEmptyState({
  onPresetSelect,
  onCreateClick,
}: PackageEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-8 py-12">
      <div className="text-center">
        <p className="text-lg font-medium text-carbon-black-700 dark:text-carbon-black-300">
          Nie masz jeszcze żadnych pakietów
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Zacznij od jednego z gotowych szablonów lub utwórz własny.
        </p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-3">
        {presets.map(({ visits, price }) => (
          <button
            key={visits}
            onClick={() => onPresetSelect(visits)}
            className="block w-full text-left"
          >
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle>{visits} wizyt</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {price} PLN
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <button
        onClick={onCreateClick}
        className="rounded-md border border-soft-linen-300 px-4 py-2 text-sm font-medium hover:bg-soft-linen-100 dark:border-carbon-black-700 dark:hover:bg-carbon-black-800 transition-colors"
      >
        Utwórz swój pierwszy pakiet
      </button>
    </div>
  )
}
