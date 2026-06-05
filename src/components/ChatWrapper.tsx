'use client'

import { useState } from 'react'
import { ChatButton } from './ChatButton'
import { ChatPanel } from './ChatPanel'

export function ChatWrapper() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <ChatButton onClick={() => setOpen(true)} />
      <ChatPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}
