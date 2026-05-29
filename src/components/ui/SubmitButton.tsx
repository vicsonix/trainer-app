'use client'

import { useFormStatus } from 'react-dom'
import Spinner from './Spinner'

interface SubmitButtonProps {
  label: string
}

export default function SubmitButton({ label }: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-lg bg-foreground text-background font-medium disabled:opacity-60 transition-opacity"
    >
      {pending ? <Spinner /> : label}
    </button>
  )
}
