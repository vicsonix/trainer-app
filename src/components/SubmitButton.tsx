'use client'

import { useFormStatus } from 'react-dom'
import Spinner from '@/components/Spinner'

interface SubmitButtonProps {
  label: string
}

export default function SubmitButton({ label }: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-60 transition-opacity hover:bg-lobster-pink-600"
    >
      {pending ? <Spinner /> : label}
    </button>
  )
}
