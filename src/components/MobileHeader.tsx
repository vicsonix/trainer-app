'use client'

import { useState } from 'react'
import { Dumbbell, Bot } from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'
import { ChatPanel } from './ChatPanel'
import { ThemeToggle } from './ThemeToggle'

export function MobileHeader() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <header className="md:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-carbon-black-900/80 backdrop-blur-md border-b border-soft-linen-200 dark:border-carbon-black-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-lobster-pink-400 to-lobster-pink-700 flex items-center justify-center shadow-sm">
            <Dumbbell size={13} className="text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Trainer</span>
        </div>

        <div className="flex items-center gap-1.5">
          <ThemeToggle compact />
          <button
            onClick={() => setOpen(true)}
            aria-label="Otwórz asystenta"
            className="flex items-center gap-1.5 rounded-lg border border-soft-linen-300 dark:border-carbon-black-700 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-soft-linen-100 dark:hover:bg-carbon-black-800 transition-colors"
          >
            <Bot size={14} className="text-tiger-orange-500 dark:text-tiger-orange-400" />
            Asystent
          </button>

          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-soft-linen-300 px-3 py-1.5 text-xs font-medium text-carbon-black-600 hover:bg-soft-linen-100 dark:border-carbon-black-700 dark:text-carbon-black-300 dark:hover:bg-carbon-black-800 transition-colors"
            >
              Wyloguj
            </button>
          </form>
        </div>
      </header>

      <ChatPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}
