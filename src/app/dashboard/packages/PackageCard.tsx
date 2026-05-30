import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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
        <EditPackageModal
          id={id}
          name={name}
          visitCount={visitCount}
          price={price}
        />
        <DeletePackageDialog
          packageId={id}
          packageName={name}
          clientCount={clientCount}
        />
      </CardFooter>
    </Card>
  )
}
