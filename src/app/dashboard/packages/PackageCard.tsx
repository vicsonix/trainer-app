import Link from 'next/link'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
        <span>{visitCount} wizyt</span>
        <span>{price.toFixed(2)} PLN łącznie</span>
        <span>{perSession} PLN / sesja</span>
      </CardContent>
      <CardFooter className="justify-between">
        <Link
          href={`/dashboard/packages/${id}/edit`}
          className="rounded-md border border-soft-linen-300 px-3 py-1.5 text-sm font-medium hover:bg-soft-linen-100 dark:border-carbon-black-700 dark:hover:bg-carbon-black-800 transition-colors"
        >
          Edytuj
        </Link>
        <DeletePackageDialog
          packageId={id}
          packageName={name}
          clientCount={clientCount}
        />
      </CardFooter>
    </Card>
  )
}
