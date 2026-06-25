'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, Users, CalendarDays, Bot, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const sectionIcons: Record<string, React.ElementType> = {
  '/dashboard': LayoutDashboard,
  '/packages':  Package,
  '/clients':   Users,
  '/calendar':  CalendarDays,
  '/assistant': Bot,
  '/analytics': BarChart2,
}

const activeStyle = {
  border: 'border-soft-linen-600 dark:border-carbon-black-500',
  text:   'text-carbon-black-900 dark:text-soft-linen-100',
  bg:     'bg-soft-linen-200 dark:bg-carbon-black-700/50',
}

interface NavLinkProps {
  href: string
  label: string
  variant?: 'sidebar' | 'bottom-bar'
}

export default function NavLink({ href, label, variant = 'sidebar' }: NavLinkProps) {
  const pathname = usePathname()
  const isActive = pathname.startsWith(href)
  const Icon = sectionIcons[href]

  if (variant === 'bottom-bar') {
    return (
      <Link
        href={href}
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium border-t-2 transition-colors',
          isActive
            ? `${activeStyle.border} ${activeStyle.text}`
            : 'border-transparent text-carbon-black-400 dark:text-carbon-black-500'
        )}
      >
        {Icon && <Icon size={20} className="shrink-0" />}
        <span>{label}</span>
      </Link>
    )
  }

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 text-sm font-medium border-l-2 transition-colors',
        isActive
          ? `${activeStyle.border} ${activeStyle.text} ${activeStyle.bg} font-semibold`
          : 'border-transparent text-carbon-black-500 hover:bg-soft-linen-100 hover:text-carbon-black-900 dark:text-carbon-black-400 dark:hover:bg-carbon-black-800 dark:hover:text-carbon-black-50'
      )}
    >
      {Icon && <Icon size={16} className="shrink-0" />}
      {label}
    </Link>
  )
}
