'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavLinkProps {
  href: string
  label: string
}

export default function NavLink({ href, label }: NavLinkProps) {
  const pathname = usePathname()
  const isActive = pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={cn(
        'rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-lobster-pink-50 text-lobster-pink-600 dark:bg-lobster-pink-950 dark:text-lobster-pink-400'
          : 'text-carbon-black-500 hover:bg-soft-linen-100 hover:text-carbon-black-900 dark:text-carbon-black-400 dark:hover:bg-carbon-black-800 dark:hover:text-carbon-black-50'
      )}
    >
      {label}
    </Link>
  )
}
