import { cn } from '@/lib/utils'

export function StatCard({
  value, label, footnote, icon: Icon, iconBg, iconColor, valueColor,
}: {
  value: React.ReactNode; label: string; footnote?: React.ReactNode
  icon: React.ElementType; iconBg: string; iconColor: string; valueColor?: string
}) {
  return (
    <div className="flex flex-col rounded-xl bg-card ring-1 ring-foreground/10 p-4 gap-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
        <Icon size={16} className={iconColor} />
      </div>
      <div>
        <p className={cn('text-3xl font-bold tracking-tight leading-none', valueColor)}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
        {footnote && <p className="text-[10px] text-muted-foreground mt-0.5">{footnote}</p>}
      </div>
    </div>
  )
}
