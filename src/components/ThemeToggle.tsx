'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme()

  if (!resolvedTheme) return null

  const isDark = resolvedTheme === 'dark'
  const icon = isDark ? <Sun size={15} /> : <Moon size={15} />

  if (compact) {
    return (
      <button
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        aria-label="Przełącz motyw"
        className="rounded-md border border-soft-linen-300 dark:border-carbon-black-700 p-1.5 text-carbon-black-600 dark:text-carbon-black-300 hover:bg-soft-linen-100 dark:hover:bg-carbon-black-800 transition-colors"
      >
        {icon}
      </button>
    )
  }

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Przełącz motyw"
      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-carbon-black-600 hover:bg-soft-linen-100 dark:text-carbon-black-300 dark:hover:bg-carbon-black-800 transition-colors"
    >
      {icon}
      {isDark ? 'Jasny motyw' : 'Ciemny motyw'}
    </button>
  )
}
