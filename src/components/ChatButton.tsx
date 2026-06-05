'use client'

import { Bot } from 'lucide-react'
import { usePathname } from 'next/navigation'

export function ChatButton({ onClick }: { onClick: () => void }) {
  const pathname = usePathname()

  if (pathname === '/assistant') return null

  return (
    <button
      onClick={onClick}
      aria-label="Otwórz asystenta"
      className="hidden md:flex fixed bottom-8 right-8 z-30 w-12 h-12 rounded-full bg-gradient-to-br from-lobster-pink-400 to-lobster-pink-700 items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
    >
      <Bot size={20} className="text-white" />
    </button>
  )
}
