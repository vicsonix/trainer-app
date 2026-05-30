import { Package, Users, CalendarDays, Bot } from 'lucide-react'

const sections = [
  {
    label: 'Pakiety',
    href: '/dashboard/packages',
    icon: Package,
    iconBg: 'bg-lobster-pink-100 dark:bg-lobster-pink-900/40',
    iconColor: 'text-lobster-pink-600 dark:text-lobster-pink-400',
    hoverRing: 'hover:ring-lobster-pink-300 dark:hover:ring-lobster-pink-800',
    hoverBg: 'hover:bg-lobster-pink-50/60 dark:hover:bg-lobster-pink-900/10',
  },
  {
    label: 'Klienci',
    href: '/dashboard/clients',
    icon: Users,
    iconBg: 'bg-jungle-teal-100 dark:bg-jungle-teal-900/40',
    iconColor: 'text-jungle-teal-600 dark:text-jungle-teal-400',
    hoverRing: 'hover:ring-jungle-teal-300 dark:hover:ring-jungle-teal-800',
    hoverBg: 'hover:bg-jungle-teal-50/60 dark:hover:bg-jungle-teal-900/10',
  },
  {
    label: 'Kalendarz',
    href: '/dashboard/calendar',
    icon: CalendarDays,
    iconBg: 'bg-tiger-orange-100 dark:bg-tiger-orange-900/40',
    iconColor: 'text-tiger-orange-600 dark:text-tiger-orange-400',
    hoverRing: 'hover:ring-tiger-orange-300 dark:hover:ring-tiger-orange-800',
    hoverBg: 'hover:bg-tiger-orange-50/60 dark:hover:bg-tiger-orange-900/10',
  },
  {
    label: 'Asystent',
    href: '/dashboard/assistant',
    icon: Bot,
    iconBg: 'bg-soft-linen-200 dark:bg-carbon-black-800',
    iconColor: 'text-carbon-black-600 dark:text-carbon-black-300',
    hoverRing: 'hover:ring-soft-linen-400 dark:hover:ring-carbon-black-600',
    hoverBg: 'hover:bg-soft-linen-100/60 dark:hover:bg-carbon-black-800/30',
  },
]

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="max-w-lg">
        <div className="inline-flex items-center gap-2 rounded-full bg-lobster-pink-100 dark:bg-lobster-pink-900/50 px-3 py-1 text-xs font-semibold text-lobster-pink-600 dark:text-lobster-pink-300 mb-5">
          <span className="size-1.5 rounded-full bg-lobster-pink-500 animate-pulse" />
          Panel trenera
        </div>

        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent mb-3">
          Witaj z powrotem!
        </h1>

        <p className="text-base text-muted-foreground leading-relaxed">
          Wybierz sekcję z menu, aby zarządzać pakietami, klientami lub kalendarzem.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {sections.map(({ label, href, icon: Icon, iconBg, iconColor, hoverRing, hoverBg }) => (
            <a
              key={href}
              href={href}
              className={`flex flex-col gap-3 rounded-xl bg-card ring-1 ring-foreground/10 p-4 transition-all duration-200 hover:shadow-md ${hoverRing} ${hoverBg}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
                <Icon size={18} className={iconColor} />
              </div>
              <span className="text-sm font-medium">{label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
